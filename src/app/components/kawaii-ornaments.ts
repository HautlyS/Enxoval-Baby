import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-kawaii-ribbon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size() * 0.68"
      viewBox="0 0 64 44"
      fill="none"
      aria-hidden="true"
      class="shrink-0 transition-transform duration-300 group-hover:scale-105"
    >
      <defs>
        <linearGradient id="ribbonSilkLight" x1="8" y1="8" x2="56" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FF80AB" />
          <stop offset="100%" stop-color="#C2185B" />
        </linearGradient>
      </defs>
      <path
        d="M31.5 21.5C24.5 14 14 7 7.5 11.5C2 15.3 4.5 25.5 11.5 27.5C18.2 29.4 25.2 25.2 31.5 21.5Z"
        fill="url(#ribbonSilkLight)"
        fill-opacity="0.22"
        stroke="#C2185B"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path
        d="M32.5 21.5C39.5 14 50 7 56.5 11.5C62 15.3 59.5 25.5 52.5 27.5C45.8 29.4 38.8 25.2 32.5 21.5Z"
        fill="url(#ribbonSilkLight)"
        fill-opacity="0.22"
        stroke="#C2185B"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path
        d="M28 24.5L18 40L24.5 36.5L28 41.5L31 26"
        stroke="#C2185B"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M36 24.5L46 40L39.5 36.5L36 41.5L33 26"
        stroke="#C2185B"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="32" cy="21.5" r="4.5" fill="#FF80AB" stroke="#111111" stroke-width="1.6" />
    </svg>
  `,
})
export class KawaiiRibbon {
  readonly size = input<number>(36);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-kawaii-floral-corner',
  template: `
    <svg
      width="120"
      height="72"
      viewBox="0 0 120 72"
      fill="none"
      aria-hidden="true"
      class="pointer-events-none select-none"
    >
      <path
        d="M6 54C28 54 34 26 56 26C78 26 84 44 114 14"
        stroke="currentColor"
        stroke-opacity="0.28"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="56" cy="26" r="3.5" fill="currentColor" fill-opacity="0.4" />
      <circle cx="114" cy="14" r="3.5" fill="currentColor" fill-opacity="0.55" />
    </svg>
  `,
})
export class KawaiiFloralCorner {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-kawaii-progress-ring',
  template: `
    <div
      class="relative inline-flex items-center justify-center shrink-0"
      [style.width.px]="size()"
      [style.height.px]="size()"
    >
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 48 48" class="-rotate-90">
        <circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          [attr.stroke]="onPink() ? 'rgba(17, 17, 17, 0.16)' : 'rgba(15, 17, 21, 0.10)'"
          stroke-width="4.5"
        />
        <circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          [attr.stroke]="onPink() ? '#111111' : '#C2185B'"
          stroke-width="4.5"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="dashOffset()"
          class="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span
        class="absolute text-[11px] font-mono font-bold tabular-nums"
        [class.text-[#111111]]="onPink()"
        [class.text-[#0F1115]]="!onPink()"
      >
        {{ clampedPct() }}%
      </span>
    </div>
  `,
})
export class KawaiiProgressRing {
  readonly pct = input<number>(0);
  readonly size = input<number>(52);
  readonly onPink = input<boolean>(false);

  protected readonly circumference = 2 * Math.PI * 19;
  protected readonly clampedPct = computed(() => Math.max(0, Math.min(100, Math.round(this.pct()))));
  protected readonly dashOffset = computed(
    () => this.circumference - (this.clampedPct() / 100) * this.circumference,
  );
}
