// Tiny diagnostic function for practising Vercel debugging.
// It returns facts about the runtime. It never returns environment variable values.
import os from 'node:os';

// Module scope runs once per function instance. A counter that grows across requests
// shows that instances are reused. A counter that resets shows a new (cold) instance.
const bootedAt = Date.now();
let invocations = 0;

export default {
  fetch(request: Request) {
    invocations += 1; // <- set a breakpoint here under `vercel dev`

    const memory = process.memoryUsage();
    const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
    const url = new URL(request.url);

    const body = {
      ok: true,
      path: url.pathname,
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      vercel: {
        env: process.env.VERCEL_ENV ?? 'not on vercel (local)',
        region: process.env.VERCEL_REGION ?? 'n/a',
        requestId: request.headers.get('x-vercel-id') ?? 'n/a',
        // Only says whether the variable exists, never its value.
        bypassSecretPresent: Boolean(process.env.VERCEL_AUTOMATION_BYPASS_SECRET),
      },
      instance: {
        invocations,
        ageSeconds: Math.round((Date.now() - bootedAt) / 1000),
        processUptimeSeconds: Math.round(process.uptime()),
      },
      resources: {
        cpuCount: os.cpus().length,
        machineMemoryMb: mb(os.totalmem()),
        rssMb: mb(memory.rss),
        heapUsedMb: mb(memory.heapUsed),
      },
    };

    // One structured line per request. This is what `vercel logs` shows as runtime output.
    console.log(JSON.stringify({
      msg: 'health',
      requestId: body.vercel.requestId,
      invocations,
      ageSeconds: body.instance.ageSeconds,
      rssMb: body.resources.rssMb,
    }));

    return Response.json(body, { headers: { 'cache-control': 'no-store' } });
  },
};
