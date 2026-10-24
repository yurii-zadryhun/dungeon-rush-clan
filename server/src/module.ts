import { Module } from '@nestjs/common';
import { Db } from './database';
import { AccountsService, AdminGuard, AuthController, OwnerGuard, SessionGuard } from './auth';
import { RankingService } from './ranking';
import { WarsController, WarsService } from './wars';
import { OcrController, VisionService } from './ocr';
import { ImportController, ImportService } from './import';
import { PlayersController, PlayersService } from './players';
import { PlayerManagementController, PlayerManagementService } from './player-management';
import { InsightsController, InsightsService } from './insights';
import { WikiAiController, WikiAiService } from './ai/wiki-ai';
import { PublicClanController, PublicClanService } from './public-clan';
import { SitePagesController, SitePagesService } from './site-pages';

@Module({
  controllers: [
    AuthController,
    WarsController,
    OcrController,
    ImportController,
    PlayersController,
    PlayerManagementController,
    InsightsController,
    WikiAiController,
    PublicClanController,
    SitePagesController,
  ],
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
    PlayersService,
    PlayerManagementService,
    InsightsService,
    WikiAiService,
    PublicClanService,
    SitePagesService,
  ],
})
export class AppModule {}
