import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { SIDES, type Side } from "@twitch-graderia/shared";
import { z } from "zod";
import { env } from "../config/env.js";
import type { GoalController } from "../match/goalController.js";
import type { StandStore } from "../aggregator/standStore.js";

const goalBody = z.object({ side: z.enum(["argentina", "mexico"]) });

export function registerControlRoutes(
  app: FastifyInstance,
  goalController: GoalController,
  standStore: StandStore,
  emitGoal: (side: Side, scoreBySide: Record<Side, number>) => void,
  onStart?: () => void,
  onEnd?: () => Promise<void> | void,
): void {
  app.get("/control", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(controlPage(Boolean(env.CONTROL_TOKEN)));
  });

  app.get("/control/score", async (request, reply) => {
    if (!authorized(request)) return reply.code(401).send({ error: "Control authorization required" });
    return { scoreBySide: standStore.createSnapshot().scoreBySide };
  });

  app.post<{ Body: unknown }>("/control/goal", async (request, reply) => {
    if (!authorized(request)) return reply.code(401).send({ error: "Control authorization required" });
    const parsed = goalBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "side must be argentina or mexico" });
    const goal = goalController.goal(parsed.data.side);
    if (!goal) return reply.code(429).send({ error: "Wait briefly before triggering another goal" });
    emitGoal(goal.side, goal.scoreBySide);
    return { goal };
  });

  app.post("/control/start", async (request, reply) => {
    if (!authorized(request)) return reply.code(401).send({ error: "Control authorization required" });
    const scoreBySide = goalController.start();
    onStart?.();
    return { scoreBySide };
  });

  app.post("/control/end", async (request, reply) => {
    if (!authorized(request)) return reply.code(401).send({ error: "Control authorization required" });
    await onEnd?.();
    return { ok: true };
  });
}

function authorized(request: FastifyRequest): boolean {
  if (env.CONTROL_TOKEN) {
    const header = request.headers.authorization;
    const supplied = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    return safeEqual(supplied, env.CONTROL_TOKEN);
  }
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.ip);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function controlPage(tokenRequired: boolean): string {
const sides = SIDES.map((side) => `<section><h2>${side.name}</h2><button data-goal="${side.id}">GOAL ${side.name.toUpperCase()}</button></section>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gradería control</title>
<style>body{font:16px system-ui;background:#101820;color:#fff;margin:2rem auto;max-width:720px;padding:0 1rem}main{display:flex;gap:1rem;flex-wrap:wrap}section{flex:1;min-width:220px;padding:1rem;background:#1d2a36;border-radius:12px}button{font:700 1rem system-ui;padding:.8rem 1rem;cursor:pointer}#score{font-size:2rem;font-weight:700}#message{min-height:1.5em;color:#ffd166}</style></head>
<body><h1>Gradería · Control</h1><p id="score">Score: …</p><main>${sides}</main><p><button id="start">Reset score / start match</button> <button id="end">END MATCH</button></p><p id="message" role="status"></p>
<script>
const tokenRequired=${tokenRequired};let controlToken=null;let tokenAsked=false;
async function ensureToken(){if(!tokenRequired)return true;if(tokenAsked)return controlToken!==null;tokenAsked=true;controlToken=window.prompt('Control token');return controlToken!==null;}
async function request(path,method='GET',body){if(!await ensureToken())return null;const headers={};if(controlToken)headers.Authorization='Bearer '+controlToken;if(body)headers['Content-Type']='application/json';const response=await fetch(path,{method,headers,body:body?JSON.stringify(body):undefined});if(response.status===401){document.querySelector('#message').textContent='Authorization failed';return null;}const data=await response.json();if(!response.ok){document.querySelector('#message').textContent=data.error||'Request failed';return null;}document.querySelector('#message').textContent='';return data;}
function showScore(score){if(!score)return;document.querySelector('#score').textContent='Argentina '+score.argentina+'  -  '+score.mexico+' Mexico';}
async function refresh(){const data=await request('/control/score');if(data)showScore(data.scoreBySide);}
document.querySelectorAll('[data-goal]').forEach(button=>button.addEventListener('click',async()=>{const data=await request('/control/goal','POST',{side:button.dataset.goal});if(data){showScore(data.goal.scoreBySide);document.querySelector('#message').textContent='GOAL triggered';}}));
document.querySelector('#start').addEventListener('click',async()=>{const data=await request('/control/start','POST',{});if(data){showScore(data.scoreBySide);document.querySelector('#message').textContent='Score reset';}});
document.querySelector('#end').addEventListener('click',async()=>{const data=await request('/control/end','POST',{});if(data)document.querySelector('#message').textContent='Generating crowd report…';});
refresh();setInterval(refresh,1500);
</script></body></html>`;
}
