import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SIGNING_KEY = Deno.env.get("CALENDLY_WEBHOOK_SIGNING_KEY")!;
async function verify(req: Request, body: string): Promise<boolean> {
  if (!SIGNING_KEY) return true;
  const sig = req.headers.get("Calendly-Webhook-Signature"); if (!sig) return false;
  const [tP,v1P] = sig.split(","); const t=tP?.split("=")[1]; const v1=v1P?.split("=")[1]; if(!t||!v1) return false;
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(SIGNING_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const s = await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${t}.${body}`));
  return Array.from(new Uint8Array(s)).map(b=>b.toString(16).padStart(2,"0")).join("")===v1;
}
serve(async (req)=>{
  if(req.method!=="POST") return new Response("Method not allowed",{status:405});
  const body=await req.text();
  if(!(await verify(req,body))) return new Response("Invalid signature",{status:401});
  let p: any; try{p=JSON.parse(body);}catch{return new Response("Bad JSON",{status:400});}
  if(p.event!=="invitee.created") return new Response("Ignored",{status:200});
  const inv=p.payload?.invitee; const ev=p.payload?.event;
  if(!inv||!ev) return new Response("Missing fields",{status:400});
  const {error}=await supabase.from("session_invitees").upsert({event_uuid:ev.uri?.split("/").pop()??"",event_name:ev.name??p.payload?.event_type?.name??"Session",event_type:p.payload?.event_type?.kind??"one_on_one",start_time:ev.start_time,end_time:ev.end_time,invitee_name:inv.name,invitee_email:inv.email},{onConflict:"event_uuid,invitee_email"});
  if(error) return new Response(JSON.stringify({error:error.message}),{status:500});
  return new Response(JSON.stringify({ok:true}),{status:200});
});
