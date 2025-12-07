# tools.org.ai

Tool implementations for AI agents and humans. This monorepo contains provider implementations that can be used through the MCP protocol.

## Architecture

```
digital-tools (abstract interfaces)
    ↓
Provider Packages (implement interfaces for specific apps)
    ↓
Aggregator Packages (unify providers for a tool type)
```

## Provider Packages

These packages implement abstract interfaces for specific apps/platforms:

| Package | Implements |
|---------|------------|
| `@tools.org.ai/github` | Repo, Task, Project, Document |
| `@tools.org.ai/google-workspace` | Spreadsheet, Document, Email, Calendar, Storage, Meeting |
| `@tools.org.ai/office-365` | Spreadsheet, Document, Email, Calendar, Storage, Meeting |
| `@tools.org.ai/xlsx` | Spreadsheet |
| `@tools.org.ai/stripe` | Payment, Invoice, Customer |
| `@tools.org.ai/resend` | Email |
| `@tools.org.ai/sendgrid` | Email |
| `@tools.org.ai/slack` | Messaging |
| `@tools.org.ai/twilio` | SMS, Voice |
| `@tools.org.ai/linear` | Task, Project |
| `@tools.org.ai/notion` | Document, Database, Task |
| `@tools.org.ai/hubspot` | CRM, Contact, Deal |
| `@tools.org.ai/shopify` | Product, Order, Customer |
| `@tools.org.ai/aws` | Storage |
| `@tools.org.ai/cloudinary` | Media |
| `@tools.org.ai/zoom` | Meeting |
| `@tools.org.ai/jitsi` | Meeting |
| `@tools.org.ai/cal` | Calendar, Booking |
| `@tools.org.ai/typeform` | Form |
| `@tools.org.ai/mailchimp` | Marketing, Audience, Campaign |
| `@tools.org.ai/zendesk` | Ticket, Support |
| `@tools.org.ai/todoist` | Task |
| `@tools.org.ai/mixpanel` | Analytics |

## Aggregator Packages

These packages aggregate providers for a tool type:

| Package | Providers |
|---------|-----------|
| `@tools.org.ai/spreadsheet` | xlsx, google-workspace, office-365 |
| `@tools.org.ai/email` | resend, sendgrid, google-workspace, office-365 |
| `@tools.org.ai/calendar` | google-workspace, office-365, cal |
| `@tools.org.ai/storage` | aws, google-workspace, office-365 |
| `@tools.org.ai/meetings` | zoom, jitsi, google-workspace, office-365 |
| `@tools.org.ai/messaging` | slack, twilio |
| `@tools.org.ai/tasks` | github, linear, todoist, notion |
| `@tools.org.ai/projects` | github, linear, notion |
| `@tools.org.ai/documents` | google-workspace, office-365, notion |
| `@tools.org.ai/repos` | github |
| `@tools.org.ai/crm` | hubspot |
| `@tools.org.ai/payments` | stripe |
| `@tools.org.ai/ecommerce` | shopify |
| `@tools.org.ai/forms` | typeform |
| `@tools.org.ai/marketing` | mailchimp |
| `@tools.org.ai/media` | cloudinary |
| `@tools.org.ai/support` | zendesk |
| `@tools.org.ai/analytics` | mixpanel |

## Usage

```typescript
// Use a specific provider
import { createGoogleSheetsProvider } from '@tools.org.ai/google-workspace'

// Or use the aggregator for flexibility
import { providers } from '@tools.org.ai/spreadsheet'
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
