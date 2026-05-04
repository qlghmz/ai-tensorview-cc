import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'TensorView'
const APP_URL = 'https://ai.tensorview.cc'

interface OrderActivatedProps {
  orderNo?: string
  plan?: string
}

const PLAN_LABEL: Record<string, string> = { pro: '专业版', team: '团队版' }
const PLAN_CREDITS: Record<string, number> = { pro: 100, team: 500 }

const OrderActivatedEmail = ({ orderNo, plan }: OrderActivatedProps) => {
  const planText = plan ? (PLAN_LABEL[plan] ?? plan) : '套餐'
  const credits = plan ? (PLAN_CREDITS[plan] ?? 0) : 0
  return (
    <Html lang="zh" dir="ltr">
      <Head />
      <Preview>套餐已激活 — 立即开始使用</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎉 套餐已激活</Heading>
          <Text style={text}>
            你的订单 <strong>{orderNo ?? ''}</strong> 已成功激活。{planText} 权益已生效，月度 <strong>{credits} 积分</strong> 已发放到你的账户。
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={`${APP_URL}/dashboard`} style={button}>进入工作台</Button>
          </Section>
          <Text style={text}>感谢支持 {SITE_NAME}，祝创作愉快！</Text>
          <Text style={footer}>— {SITE_NAME} 团队</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderActivatedEmail,
  subject: (data: Record<string, any>) => `${data.plan === 'team' ? '团队版' : '专业版'} 已激活`,
  displayName: '订单激活通知',
  previewData: { orderNo: 'LV20260504120000', plan: 'pro' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 14px' }
const button = { backgroundColor: '#6366f1', color: '#ffffff', padding: '12px 22px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0' }
