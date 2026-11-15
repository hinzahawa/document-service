import { resolve } from 'node:path';

export default () => ({
  storage: {
    templateRoot: resolve(process.cwd(), process.env.TEMPLATE_ROOT?.trim() || 'template'),
    backupRoot: resolve(process.cwd(), process.env.BACKUP_ROOT?.trim() || 'storage'),
  },
  generation: {
    timeZone: getTimeZone(),
  },
});

function getTimeZone(): string {
  const timeZone = process.env.APP_TIMEZONE?.trim() || 'Asia/Bangkok';
  new Intl.DateTimeFormat('en-US', { timeZone });
  return timeZone;
}
