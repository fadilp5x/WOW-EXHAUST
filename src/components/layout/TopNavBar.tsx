import { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Compass,
  Eye,
  FolderClock,
  Mail,
  Menu,
  Presentation,
  RotateCcw,
  Scan,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';

export type UnseenRoute =
  | '/'
  | '/investigations'
  | '/tools'
  | '/impact'
  | '/about'
  | '/contact';

interface TopNavBarProps {
  currentRoute: UnseenRoute;
  onNavigate: (route: UnseenRoute) => void;
  judgeMode?: boolean;
  onToggleJudgeMode?: () => void;
  redteamMode?: boolean;
  onToggleRedteam?: () => void;
  onReplayExperience?: () => void;
  savedCount?: number;
}

const NAV_ITEMS: Array<{
  route: UnseenRoute;
  label: string;
  icon: typeof Scan;
}> = [
  { route: '/', label: 'Scan', icon: Scan },
  { route: '/about', label: 'About', icon: Compass },
  { route: '/tools', label: 'Tools', icon: Wrench },
  { route: '/impact', label: 'Impact', icon: Activity },
  { route: '/investigations', label: 'Reports', icon: FolderClock },
  { route: '/contact', label: 'Contact', icon: Mail },
];

export function TopNavBar({
  currentRoute,
  onNavigate,
  judgeMode = false,
  onToggleJudgeMode,
  redteamMode = false,
  onToggleRedteam,
  onReplayExperience,
}: TopNavBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (route: UnseenRoute) => {
    setMobileOpen(false);
    onNavigate(route);
  };

  return (
    <header className="sticky top-0 z-40 h-[72px] border-b border-[#08090B]/7 bg-[#FAF8F3]/95 backdrop-blur-md px-4 sm:px-6">
      <div className="max-w-[1440px] h-full mx-auto flex items-center justify-between gap-3">
        {/* Left Brand Mark + Initiative Watermark */}
        <button
          type="button"
          onClick={() => handleNav('/')}
          className="flex items-center gap-2.5 text-left group cursor-pointer shrink-0"
        >
          <div className="w-9 h-9 rounded-full bg-[#08090B] border-2 border-[#CDF22B] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Eye className="w-4.5 h-4.5 text-[#CDF22B]" />
          </div>
          <div className="leading-none">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#08090B]">
                EXHAUST
              </span>
              <span className="hidden xl:inline-block font-mono text-[9px] tracking-[0.12em] uppercase px-1.5 py-0.5 rounded-md bg-[#ECFFB6] text-[#08090B] font-semibold">
                UNSEEN v2.4
              </span>
            </div>
            <span className="block font-mono text-[8px] sm:text-[9px] tracking-[0.14em] text-[#525866] uppercase mt-0.5">
              AN INITIATIVE BY PROJECT WOW UNSEEN
            </span>
          </div>
        </button>

        {/* Center Route Pill Capsule */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-1 bg-white border border-[#08090B]/10 rounded-full p-1 shadow-[0_2px_12px_rgba(8,9,11,0.04)]"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNav(item.route)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3.5 py-1.5 rounded-full font-sans text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#CDF22B]/22 text-[#08090B] font-bold border border-[#CDF22B]/50 shadow-[0_0_14px_rgba(205,242,43,0.25)]'
                    : 'text-[#525866] hover:text-[#08090B] hover:bg-[#FAF8F3]'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="w-1.5 h-1.5 rounded-full bg-[#CDF22B] ring-1 ring-[#08090B]/30"
                  />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {currentRoute === '/' ? (
            <>
              {onToggleJudgeMode && (
                <button
                  type="button"
                  onClick={onToggleJudgeMode}
                  aria-pressed={judgeMode}
                  className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    judgeMode ? 'btn-tactile-lime' : 'btn-tactile-secondary'
                  }`}
                >
                  <Presentation className="w-3.5 h-3.5" />
                  <span>Judge Live</span>
                </button>
              )}

              {onToggleRedteam && (
                <button
                  type="button"
                  onClick={onToggleRedteam}
                  aria-pressed={redteamMode}
                  className={`hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap rounded-full transition-all ${
                    redteamMode
                      ? 'bg-[#FF4B4B] text-white shadow-[0_4px_0_#b91c1c]'
                      : 'btn-tactile-dark !rounded-full'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-[#CDF22B]" />
                  <span>{redteamMode ? 'Redteam Active' : 'Redteam View'}</span>
                </button>
              )}

              {onReplayExperience && (
                <button
                  type="button"
                  onClick={onReplayExperience}
                  title="Watch 3-Act Story Intro"
                  aria-label="Replay Story Intro"
                  className="hidden xl:inline-flex w-9 h-9 rounded-full bg-white border border-[#08090B]/12 items-center justify-center text-[#525866] hover:text-[#08090B] hover:border-[#08090B]/30 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleNav('/tools')}
              className="hidden sm:inline-flex btn-tactile-dark !rounded-full px-4 py-2 text-xs items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>Explore UNSEEN</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Mobile Hamburger Menu Button */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden w-11 h-11 rounded-2xl bg-white border border-[#08090B]/12 flex items-center justify-center text-[#08090B] cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Overlay */}
      {mobileOpen && (
        <div className="lg:hidden absolute inset-x-0 top-[72px] bg-[#FAF8F3] border-b border-[#08090B]/12 px-4 py-4 shadow-xl space-y-3 z-50">
          <div className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => handleNav(item.route)}
                  className={`min-h-[44px] px-3.5 py-2.5 rounded-2xl font-sans text-xs font-semibold flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-[#CDF22B] text-[#08090B] border border-[#08090B]/15'
                      : 'bg-white text-[#08090B] border border-[#08090B]/10'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-[#08090B]" />}
                </button>
              );
            })}
          </div>

          {currentRoute === '/' && (onToggleJudgeMode || onToggleRedteam || onReplayExperience) && (
            <div className="pt-2 border-t border-[#08090B]/10 flex flex-wrap gap-2">
              {onToggleJudgeMode && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleJudgeMode();
                    setMobileOpen(false);
                  }}
                  className="flex-1 min-h-[44px] btn-tactile-secondary px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Presentation className="w-3.5 h-3.5" />
                  {judgeMode ? 'Exit Judge Mode' : 'Judge Live'}
                </button>
              )}
              {onToggleRedteam && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleRedteam();
                    setMobileOpen(false);
                  }}
                  className="flex-1 min-h-[44px] btn-tactile-dark px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-[#CDF22B]" />
                  {redteamMode ? 'Redteam Active' : 'Redteam View'}
                </button>
              )}
              {onReplayExperience && (
                <button
                  type="button"
                  onClick={() => {
                    onReplayExperience();
                    setMobileOpen(false);
                  }}
                  className="w-full min-h-[44px] btn-tactile-secondary px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Replay Story Intro
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
