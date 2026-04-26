import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { google, drive_v3 } from 'googleapis';

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);

  private getAuth() {
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!json) {
      throw new BadRequestException(
        'Google Drive не настроен: отсутствует GOOGLE_SERVICE_ACCOUNT_JSON',
      );
    }
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(json) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        'GOOGLE_SERVICE_ACCOUNT_JSON содержит невалидный JSON',
      );
    }
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  /**
   * Creates folder structure: <rightsHolderName>/<contentTitle> on Google Drive,
   * grants writer access to the given email address and returns the folder URL.
   *
   * If a folder with the same name already exists under the same parent it is
   * reused rather than duplicated.
   */
  async createDealFolder(opts: {
    rightsHolderName: string;
    contentTitle: string;
    email: string;
  }): Promise<string> {
    const auth = this.getAuth();
    const drive = google.drive({ version: 'v3', auth });

    const rootParentId =
      process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID ?? 'root';

    this.logger.log(
      `Creating Drive folder: "${opts.rightsHolderName}" / "${opts.contentTitle}" for ${opts.email}`,
    );

    // 1. Find or create the rights-holder folder
    const rhFolderId = await this.findOrCreateFolder(
      drive,
      opts.rightsHolderName,
      rootParentId,
    );

    // 2. Find or create the content subfolder
    const contentFolderId = await this.findOrCreateFolder(
      drive,
      opts.contentTitle,
      rhFolderId,
    );

    // 3. Grant writer access to the provided email
    try {
      await drive.permissions.create({
        fileId: contentFolderId,
        requestBody: {
          type: 'user',
          role: 'writer',
          emailAddress: opts.email,
        },
        sendNotificationEmail: true,
      });
    } catch (err) {
      // Permission grant may fail if the email is not a Google account —
      // log but don't block; the folder is still usable.
      this.logger.warn(
        `Could not grant Drive permission to ${opts.email}: ${String(err)}`,
      );
    }

    const folderUrl = `https://drive.google.com/drive/folders/${contentFolderId}`;
    this.logger.log(`Drive folder ready: ${folderUrl}`);
    return folderUrl;
  }

  private async findOrCreateFolder(
    drive: drive_v3.Drive,
    name: string,
    parentId: string,
  ): Promise<string> {
    // Escape single quotes in the name for the Drive query
    const safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const listRes = await drive.files.list({
      q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: 'files(id)',
      pageSize: 1,
      spaces: 'drive',
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
      return listRes.data.files[0].id!;
    }

    const createRes = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });

    return createRes.data.id!;
  }
}
