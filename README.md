# Document service

NestJS API that fills the HTML insurance application form and returns it as a PDF. A request JSON archive is written only after the PDF has rendered successfully.

## Run locally

```bash
npm ci
npm run playwright:install
npm run start:dev
```

The Chromium process needs a Thai-capable font. The template uses Noto Sans Thai, Sarabun, and Tahoma fallbacks.

## Configuration

Copy `.env.example` to `.env` and set the paths for your environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TEMPLATE_ROOT` | `./template` | Folder containing `Application_DemoV3.html` |
| `BACKUP_ROOT` | `./storage` | Root folder for archived request JSON files |
| `APP_TIMEZONE` | `Asia/Bangkok` | Time zone used in archive folder names |
| `PORT` | `3000` | HTTP port |

Relative paths are resolved from the project working directory. The local archive contains applicant data and is excluded from Git.

## Generate a PDF

Send a JSON request to `POST /generate`. The response is an inline `application/pdf`; the matching request is archived under `appForm/YYYYMMDD/{applicationId}-YYYYMMDD-HHMMSS/`.

See [the API guide](docs/generate-api.md) for the request contract, field map, response headers, and error cases. [The template field map](docs/template-field-map.json) lists each supported field and its location in the form.
