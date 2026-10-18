import { Module } from '@nestjs/common';
import { Db } from './database';
import { AccountsService, AdminGuard, AuthController, OwnerGuard, SessionGuard } from './auth';
import { RankingService } from './ranking';
import { WarsController, WarsService } from './wars';
import { OcrController, VisionService } from './ocr';
import { ImportController, ImportService } from './import';

@Module({
  controllers: [AuthController, WarsController, OcrController, ImportController],
  providers: [
    Db,
    AccountsService,
    SessionGuard,
    AdminGuard,
    OwnerGuard,
    RankingService,
    WarsService,
    VisionService,
    ImportService,
  ],
})
export class AppModule {}
