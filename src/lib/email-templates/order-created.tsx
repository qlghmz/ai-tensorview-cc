import { Body, Container, Head, Heading, Html, Preview, Text, Section, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'TensorView'

interface OrderCreatedProps {
  orderNo?: string
  plan?: string
  amount?: number
}

const PLAN_LABEL: Record<string, string> = { pro: '专业版', team: '团队版' }

const OrderCreatedEmail = ({ orderNo, plan, amount }: OrderCreatedProps) => {
  const planText = plan ? (PLAN_LABEL[plan] ?? plan) : '套餐'
  return (
    <Html lang="zh" dir="ltr">
      <Head />
      <Preview>订单已创建，等待支付确认</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>订单已创建</Heading>
          <Text style={text}>我们已收到你的 {planText} 升级请求。请按提示完成支付，支付确认后会自动发放积分。</Text>
          <Section style={card}>
            <Text style={kv}><span style={k}>订单号</span><span style={v}>{orderNo ?? '—'}</span></Text>
            <Hr style={hr} />
            <Text style={kv}><span style={k}>套餐</span><span style={v}>{planText}</span></Text>
            <Hr style={hr} />
            <Text style={kv}><span style={k}>金额</span><span style={v}>¥{amount ?? '—'}</span></Text>
          </Section>
          <Text style={text}>如需协助，请回复本邮件。</Text>
          <Text style={footer}>— {SITE_NAME} 团队</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderCreatedEmail,
  subject: (data: Record<string, any>) => `订单 ${data.orderNo ?? ''} 已创建`,
  displayName: '订单创建确认',
  previewData: { orderNo: 'LV20260504120000', plan: 'pro', amount: 99 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 14px' }
const card = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px', margin: '16px 0' }
const kv = { fontSize: '14px', color: '#0f172a', display: 'flex', justifyContent: 'space-between', margin: '4px 0' }
const k = { color: '#64748b' }
const v = { fontWeight: 600 }
const hr = { borderColor: '#e2e8f0', margin: '8px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0' }
