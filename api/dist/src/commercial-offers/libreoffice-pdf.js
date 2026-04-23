"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertDocxBufferToPdf = convertDocxBufferToPdf;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path = __importStar(require("path"));
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
function resolveSofficePath() {
    const fromEnv = process.env.LIBREOFFICE_PATH?.trim();
    if (fromEnv && (0, fs_1.existsSync)(fromEnv))
        return fromEnv;
    const mac = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    if ((0, fs_1.existsSync)(mac))
        return mac;
    const macAlt = '/Applications/LibreOffice.app/Contents/MacOS/LibreOffice';
    if ((0, fs_1.existsSync)(macAlt))
        return macAlt;
    return process.platform === 'win32' ? 'soffice.exe' : 'soffice';
}
async function convertDocxBufferToPdf(docxBuffer) {
    const soffice = resolveSofficePath();
    const dir = await (0, promises_1.mkdtemp)(path.join((0, os_1.tmpdir)(), 'cf-offer-'));
    const docxPath = path.join(dir, 'offer.docx');
    const pdfPath = path.join(dir, 'offer.pdf');
    try {
        await (0, promises_1.writeFile)(docxPath, docxBuffer);
        await execFileAsync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', dir, docxPath], { timeout: 120_000, maxBuffer: 50 * 1024 * 1024 });
        return await (0, promises_1.readFile)(pdfPath);
    }
    catch (e) {
        const msg = e instanceof Error
            ? e.message
            : 'Не удалось сконвертировать DOCX в PDF. Установите LibreOffice и при необходимости задайте LIBREOFFICE_PATH.';
        throw new Error(`${msg} Ожидается команда LibreOffice (soffice).`);
    }
    finally {
        await (0, promises_1.rm)(dir, { recursive: true, force: true });
    }
}
//# sourceMappingURL=libreoffice-pdf.js.map