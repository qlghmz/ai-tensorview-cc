import { Body, Container, Head, Heading, Html, Preview, Text, Button, Section } from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'TensorView'
const APP_URL = 'https://ai.tensorview.cc'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="zh" dir="ltr">
    <Head />
    <Preview>欢迎来到 {SITE_NAME} — 用一句话生成你的网页应用</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{name ? `你好，${name} 👋` : `欢迎来到 ${SITE_NAME}`}</Heading>
        <Text style={text}>
          感谢注册 {SITE_NAME}！我们已为你赠送 <strong>30 个积分</strong>，并且每天会自动补到 5 个。
        </Text>
        <Text style={text}>立即用一句话描述你想要的网站，AI 会帮你生成可运行的代码。</Text>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={`${APP_URL}/dashboard`} style={button}>开始创建项目</Button>
        </Section>
        <Text style={footer}>— {SITE_NAME} 团队</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `欢迎来到 ${SITE_NAME}`,
  displayName: '注册欢迎',
  previewData: { name: '小明' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 14px' }
const button = { backgroundColor: '#6366f1', color: '#ffffff', padding: '12px 22px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0' }
