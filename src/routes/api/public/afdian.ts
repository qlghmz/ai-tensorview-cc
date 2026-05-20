import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// 爱发电 webhook 自动激活
// 文档: https://afdian.com/p/d2fdba846b7c11ec99c052540025c377
// 签名: md5( JSON.stringify(params, sortedKeys) + token )
// 我们要求买家在下单时把我们的 order_no 填入 "自定义订单号"
// (创建赞助方案时勾选"显示自定义订单号"，或通过 URL 传入)
//
// 配置:
//   1. 在爱发电后台开启 webhook，回调地址填本路由完整 URL
//   2. 把后台的 token 设置为 Lovable 项目的 AFDIAN_TOKEN secret

function md5(s: string) {
  return createHash("md5").update(s, "utf8").digest("hex");
}

// 爱发电签名: 对 params 按 key 排序后 stringify，再拼 token 取 md5
function buildExpectedSign(params: unknown, token: string): string {
  const sortKeys = (obj: any): any => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    const out: Record<string, any> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k]);
    return out;
  };
  return md5(JSON.stringify(sortKeys(params)) + token);
}

export const Route = createFileRoute("/api/public/afdian")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.AFDIAN_TOKEN;
        if (!token) {
          console.error("[afdian] AFDIAN_TOKEN not set");
          return new Response(JSON.stringify({ ec: 500, em: "server not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ec: 400, em: "invalid json" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 爱发电格式: { ec, em, data: { type, order: {...} }, sign? }
        // 兼容两种：sign 在顶层 / 不带 sign 但 data.params 包含
        const data = body?.data;
        if (!data) {
          return new Response(JSON.stringify({ ec: 400, em: "missing data" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const order = data?.order;
        // 测试 ping 无 order，直接返回成功（爱发电后台"发送测试"会走这里）
        if (!order) {
          return new Response(JSON.stringify({ ec: 200, em: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 真实订单：强制校验签名（缺失/不匹配一律拒绝）
        const sign: string | undefined = body?.sign;
        if (!sign) {
          console.warn("[afdian] missing sign");
          return new Response(JSON.stringify({ ec: 401, em: "missing sign" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const params = body?.params ?? data;
        const expected = buildExpectedSign(params, token);
        // 常数时间比较，避免 timing attack
        const a = Buffer.from(sign, "utf8");
        const b = Buffer.from(expected, "utf8");
        const equal = a.length === b.length && (await import("crypto")).timingSafeEqual(a, b);
        if (!equal) {
          console.warn("[afdian] sign mismatch");
          return new Response(JSON.stringify({ ec: 403, em: "sign invalid" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 关键字段
        const customOrderId: string | undefined = order.custom_order_id || order.remark;
        const tradeNo: string = order.out_trade_no || order.trade_no || "";
        // total_amount 单位是元，字符串
        const amountYuan = parseFloat(order.total_amount || "0");
        const amountCny = Math.round(amountYuan); // 元

        if (!customOrderId) {
          console.warn("[afdian] missing custom_order_id, trade=", tradeNo);
          return new Response(JSON.stringify({ ec: 200, em: "ignored: no order_no" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: rpcRes, error } = await supabaseAdmin.rpc("activate_paid_order", {
          _order_no: customOrderId,
          _provider: "afdian",
          _provider_trade_no: tradeNo,
          _amount_cny: amountCny,
        });

        if (error) {
          console.error("[afdian] rpc error", error);
          return new Response(JSON.stringify({ ec: 500, em: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        console.log("[afdian] activated", { order_no: customOrderId, result: rpcRes });
        return new Response(JSON.stringify({ ec: 200, em: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },

      GET: async () => {
        return new Response("afdian webhook endpoint", { status: 200 });
      },
    },
  },
});
