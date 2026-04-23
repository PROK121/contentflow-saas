import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTaskCommentDto {
  @IsString()
  @MinLength(1, { message: 'Введите текст комментария' })
  @MaxLength(8000)
  body!: string;
}
