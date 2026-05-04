import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as welcome } from './welcome'
import { template as orderCreated } from './order-created'
import { template as orderActivated } from './order-activated'

export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome,
  'order-created': orderCreated,
  'order-activated': orderActivated,
}
