import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { ActOneConfession } from './components/cinematic/ActOneConfession';
import { ActTwoWall } from './components/cinematic/ActTwoWall';
import { MachineShell } from './components/machine/MachineShell';

type ActStage = 'act1' | 'act2' | 'act3';

function getInitialAct(): ActStage {
  if (typeof window === 'undefined') return 'act3';
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') return 'act3';
  if (params.get('act') === '1') return 'act1';
  if (params.get('act') === '2') return 'act2';
  // Open straight into the UNSEEN workstation so multi-page routes & scanner render immediately;
  // Act I & Act II remain 1-click accessible via Replay Story Intro / View Wall.
  return 'act3';
}

export default function App() {
  const [act, setAct] = useState<ActStage>(getInitialAct);
  const [queuedSample, setQueuedSample] = useState<'gps' | 'pdf' | 'text' | null>(
    null
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setAct('act3');
    }
  }, []);

  const handleReplayIntro = () => {
    try {
      sessionStorage.removeItem('exhaust_intro_viewed');
    } catch {
      // ignore
    }
    setAct('act1');
  };

  return (
    <>
      <Toaster
        theme="light"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#08090B',
            border: '1px solid rgba(205, 242, 43, 0.35)',
            color: '#FAF8F3',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px',
            borderRadius: '16px',
          },
        }}
      />

      {act === 'act1' && (
        <ActOneConfession
          onLaunch={() => setAct('act2')}
          onSkipToMachine={() => setAct('act3')}
        />
      )}

      {act === 'act2' && (
        <ActTwoWall
          onStartXray={() => setAct('act3')}
          onLoadSample={(sample) => {
            setQueuedSample(sample);
            setAct('act3');
          }}
          onReplayIntro={handleReplayIntro}
        />
      )}

      {act === 'act3' && (
        <MachineShell
          initialSample={queuedSample}
          onConsumeInitialSample={() => setQueuedSample(null)}
          onReplayExperience={handleReplayIntro}
          onViewWall={() => setAct('act2')}
        />
      )}
    </>
  );
}
