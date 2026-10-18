import { Module } from '@nestjs/common';
import { Db } from './database';
import { AccountsService, AuthController, SessionGuard, AdminGuard, OwnerGuard } from './auth';
import { RankingService } from './ranking';
import { WarsService, WarsController } from './wars';
import { VisionService, OcrController } from './ocr';
import { ImportService, ImportController } from './import';

@Module({
  controllers:[AuthController,WarsController,OcrController,ImportController],
  providers:[Db,AccountsService,SessionGuard,AdminGuard,OwnerGuard,RankingService,WarsService,VisionService,ImportService],
})
export class AppModule {}
