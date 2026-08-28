import { useEffect, useReducer } from 'react';
import {
  Activity,
  BatteryMedium,
  Check,
  CircleAlert,
  Crosshair,
  EyeOff,
  KeyRound,
  Play,
  Radio,
  RefreshCcw,
  Satellite,
  ShieldCheck,
} from 'lucide-react';
import { Alert, Badge, Button, Card, Progress, cn } from './components/ui';
import { networkConfig } from './network';
import { advanceSimulation, resetSimulation } from './simulator';
import type { Drone, ProofStatus, SimulationState } from './types';

type Action = { type: 'start' } | { type: 'advance' } | { type: 'reset' };

function reducer(state: SimulationState, action: Action): SimulationState {
  if (action.type === 'reset') return resetSimulation();
  if (action.type === 'start') return { ...resetSimulation(), running: true };
  return advanceSimulation(state);
}

const proofTone: Record<ProofStatus, string> = {
  idle: 'text-slate-500',
  generating: 'text-sky-300',
  verified: 'text-emerald-300',
  failed: 'text-rose-300',
};

function DroneRow({ drone }: { drone: Drone }) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-3 border-t border-white/6 px-4 py-3 first:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              drone.status === 'attention' ? 'bg-rose-400' : 'bg-emerald-400',
            )}
          />
          <strong className="text-sm text-slate-100">{drone.id}</strong>
          <span className="truncate text-xs text-slate-500">{drone.label}</span>
        </div>
        <p className="mt-1 truncate pl-3.5 text-xs text-slate-400">{drone.assignment}</p>
      </div>
      <div>
        <p
          className={cn(
            'text-[11px] font-bold uppercase tracking-wider',
            proofTone[drone.proofStatus],
          )}
        >
          {drone.proofStatus}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{drone.status}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-slate-400">
        <BatteryMedium className="h-3.5 w-3.5" />
        {drone.battery}%
      </div>
    </div>
  );
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, resetSimulation);
  const progress = Math.round(
    (state.mission.completedCheckpoints / state.mission.totalCheckpoints) * 100,
  );

  useEffect(() => {
    if (!state.running) return;
    const timer = window.setTimeout(() => dispatch({ type: 'advance' }), 700);
    return () => window.clearTimeout(timer);
  }, [state.running, state.step]);

  return (
    <div className="min-h-screen bg-[#06100f] text-slate-200">
      <div className="noise min-h-screen">
        <header className="border-b border-white/7 bg-[#071210]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-300/20 bg-emerald-300/8">
                <Satellite className="h-4.5 w-4.5 text-emerald-300" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-emerald-300/80">
                  Midnight Network
                </p>
                <h1 className="text-sm font-semibold tracking-wide text-white">Swarm Command</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="hidden border-emerald-300/15 text-emerald-200 sm:inline-flex">
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                systems nominal
              </Badge>
              <Badge>{networkConfig.target}</Badge>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
          <section className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                <span>MISSIONS</span>
                <span>/</span>
                <span className="text-slate-300">{state.mission.id}</span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {state.mission.name}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {state.mission.sector} · proof-backed checkpoint sweep
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => dispatch({ type: 'start' })}
                disabled={state.running}
                aria-label="Start mission"
              >
                <Play className="h-4 w-4 fill-current" />
                {state.step > 0 ? 'Run again' : 'Start mission'}
              </Button>
              <Button variant="outline" onClick={() => dispatch({ type: 'reset' })}>
                <RefreshCcw className="h-4 w-4" /> Reset
              </Button>
            </div>
          </section>

          <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={Activity}
              label="Mission progress"
              value={`${progress}%`}
              note={`${state.mission.completedCheckpoints} of ${state.mission.totalCheckpoints} verified`}
            />
            <Metric
              icon={Radio}
              label="Swarm online"
              value="3 / 3"
              note="Encrypted telemetry links"
            />
            <Metric
              icon={ShieldCheck}
              label="Proofs verified"
              value={String(state.mission.completedCheckpoints)}
              note="Public outcomes only"
            />
            <Metric
              icon={CircleAlert}
              label="Proof failures"
              value={String(state.failedProofs)}
              note={state.failedProofs ? 'Operator review required' : 'No active alerts'}
              alert={state.failedProofs > 0}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/7 px-4 py-3.5 sm:px-5">
                <div>
                  <h3 className="text-sm font-semibold text-white">Operational sector</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Abstract positions · raw coordinates hidden
                  </p>
                </div>
                <Badge>
                  <EyeOff className="mr-1.5 h-3 w-3" /> privacy view
                </Badge>
              </div>
              <div className="sector-map relative m-3 h-[310px] overflow-hidden rounded-lg sm:m-4 sm:h-[390px]">
                <div className="absolute left-[14%] top-[16%] h-[28%] w-[25%] rounded-lg border border-dashed border-sky-300/18 bg-sky-300/3" />
                <div className="absolute bottom-[13%] right-[12%] h-[31%] w-[31%] rounded-lg border border-dashed border-emerald-300/20 bg-emerald-300/3" />
                <div className="absolute left-4 top-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <Crosshair className="h-3 w-3" /> Sector topology / obfuscated
                </div>
                {state.drones.map((drone) => (
                  <div
                    key={drone.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
                    style={{
                      left: `${drone.sectorPosition.leftPercent}%`,
                      top: `${drone.sectorPosition.topPercent}%`,
                    }}
                  >
                    <span
                      className={cn(
                        'absolute -inset-3 rounded-full border',
                        drone.proofStatus === 'generating'
                          ? 'animate-ping border-sky-300/50'
                          : drone.proofStatus === 'failed'
                            ? 'border-rose-300/30'
                            : 'border-emerald-300/20',
                      )}
                    />
                    <div
                      className={cn(
                        'relative grid h-8 w-8 place-items-center rounded-full border shadow-lg',
                        drone.proofStatus === 'failed'
                          ? 'border-rose-300/40 bg-rose-400/15 text-rose-200'
                          : 'border-emerald-300/35 bg-[#0d2520] text-emerald-200',
                      )}
                    >
                      <Satellite className="h-3.5 w-3.5" />
                    </div>
                    <span className="absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/50 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                      {drone.id}
                    </span>
                  </div>
                ))}
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-md border border-white/7 bg-black/25 px-3 py-2 backdrop-blur-sm">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Completion
                  </span>
                  <Progress value={progress} className="flex-1" />
                  <span className="font-mono text-xs text-emerald-300">{progress}%</span>
                </div>
              </div>
            </Card>

            <div className="grid content-start gap-4">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/7 px-4 py-3.5">
                  <h3 className="text-sm font-semibold text-white">Swarm units</h3>
                  <span className="font-mono text-[10px] text-slate-500">3 ACTIVE LINKS</span>
                </div>
                {state.drones.map((drone) => (
                  <DroneRow key={drone.id} drone={drone} />
                ))}
              </Card>

              {state.failedProofs > 0 && (
                <Alert className="flex gap-3">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">Proof rejected for MS-07</p>
                    <p className="mt-1 text-xs text-amber-100/60">
                      No private evidence was disclosed.
                    </p>
                  </div>
                </Alert>
              )}
            </div>
          </div>

          <Card className="mt-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/7 px-4 py-3.5 sm:px-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Verified mission history</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tamper-resistant outcomes · evidence remains private
                </p>
              </div>
              <KeyRound className="h-4 w-4 text-emerald-300/70" />
            </div>
            {state.events.length === 0 ? (
              <div className="grid min-h-28 place-items-center px-4 text-center text-xs text-slate-500">
                Start the mission to generate proof-backed events.
              </div>
            ) : (
              <div className="divide-y divide-white/6">
                {state.events.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-[90px_1fr_auto] sm:items-center sm:px-5"
                  >
                    <span className="font-mono text-[10px] text-slate-500">{item.timestamp}</span>
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                        {item.status === 'verified' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <CircleAlert className="h-3.5 w-3.5 text-rose-300" />
                        )}
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <Badge
                      className={item.status === 'verified' ? 'text-emerald-300' : 'text-rose-300'}
                    >
                      {item.droneId} · {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  alert = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
  alert?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className={cn('mt-3 text-2xl font-semibold text-white', alert && 'text-rose-200')}>
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <div
          className={cn(
            'rounded-md bg-emerald-300/7 p-2 text-emerald-300',
            alert && 'bg-rose-300/8 text-rose-300',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
