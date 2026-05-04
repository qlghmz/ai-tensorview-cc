import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Loader2, MailX, Check } from 'lucide-react'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? '' }),
})

type State = 'loading' | 'valid' | 'invalid' | 'already' | 'success' | 'submitting' | 'error'

function UnsubscribePage() {
  const { token } = Route.useSearch()
  const [state, setState] = useState<State>('loading')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) { setState('invalid'); return }
        if (data.valid) setState('valid')
        else if (data.reason === 'already_unsubscribed') setState('already')
        else setState('invalid')
      })
      .catch(() => setState('invalid'))
  }, [token])

  const confirm = async () => {
    setState('submitting')
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setErrMsg(data.error ?? '操作失败'); setState('error'); return }
      if (data.success) setState('success')
      else if (data.reason === 'already_unsubscribed') setState('already')
      else setState('error')
    } catch (e) {
      setErrMsg((e as Error).message)
      setState('error')
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--gradient-hero)' }}>
      <div className="glass rounded-3xl p-8 max-w-md w-full text-center">
        <div className="inline-grid h-14 w-14 place-items-center rounded-2xl btn-brand mb-4">
          <MailX className="h-6 w-6" />
        </div>
        {state === 'loading' && (
          <div className="text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 验证链接中…</div>
        )}
        {state === 'valid' && (
          <>
            <h1 className="text-xl font-bold mb-2">退订邮件订阅</h1>
            <p className="text-sm text-muted-foreground mb-6">点击下方按钮，将不再向你发送邮件。</p>
            <button onClick={confirm} className="rounded-xl btn-brand px-6 py-2.5 text-sm font-semibold">确认退订</button>
          </>
        )}
        {state === 'submitting' && (
          <div className="text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 处理中…</div>
        )}
        {state === 'success' && (
          <>
            <Check className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h1 className="text-xl font-bold mb-2">已成功退订</h1>
            <p className="text-sm text-muted-foreground">你不会再收到我们的邮件。</p>
          </>
        )}
        {state === 'already' && (
          <>
            <h1 className="text-xl font-bold mb-2">已退订</h1>
            <p className="text-sm text-muted-foreground">你已经退订过了，无需重复操作。</p>
          </>
        )}
        {state === 'invalid' && (
          <>
            <h1 className="text-xl font-bold mb-2">链接无效</h1>
            <p className="text-sm text-muted-foreground">此退订链接已失效或不存在。</p>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="text-xl font-bold mb-2">操作失败</h1>
            <p className="text-sm text-muted-foreground">{errMsg || '请稍后再试。'}</p>
          </>
        )}
      </div>
    </div>
  )
}
