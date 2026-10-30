import { Module } from '@nestjs/common';
import { AuditController, AuditService } from './audit';
import { Db } from './database';
import { MembershipService } from './membership';
import { ClanRosterController, ClanRosterService } from './clan-roster';
import { AccountsService, AdminGuard, OwnerGuard, SessionGuard } from './auth';
import { AuthController } from './auth-controller';
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
    AuditController,
    AuthController,
    WarsController,
    OcrController,
    ImportController,
    PlayersController,
    ClanRosterController,
    PlayerManagementController,
    InsightsController,
    WikiAiController,
    PublicClanController,
    SitePagesController,
  ],
  providers: [
    AuditService,
    Db,
    MembershipService,
    ClanRosterService,
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
