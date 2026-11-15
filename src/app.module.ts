import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalDisk, StorageModule, type StorageModuleOptions } from '@nestjs/storage';
import { resolve } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import configuration from './config/configuration.js';
import { GenerationModule } from './generation/generation.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    StorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageModuleOptions => ({
        default: 'backups',
        disks: {
          templates: new LocalDisk({
            root: resolve(config.getOrThrow<string>('storage.templateRoot')),
          }),
          backups: new LocalDisk({
            root: resolve(config.getOrThrow<string>('storage.backupRoot')),
          }),
        },
      }),
    }),
    GenerationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
