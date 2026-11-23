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
        <linearGradient id="ribbonSilk" x1="8" y1="8" x2="56" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFE4EE" />
          <stop offset="52%" stop-color="#FBCFE8" />
          <stop offset="100%" stop-color="#F9A8D4" />
        </linearGradient>
        <linearGradient id="ribbonTail" x1="20" y1="24" x2="44" y2="41" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FBCFE8" />
          <stop offset="100%" stop-color="#F472B6" stop-opacity="0.72" />
        </linearGradient>
      </defs>
      <path
        d="M31.5 21.5C24.5 14 14 7 7.5 11.5C2 15.3 4.5 25.5 11.5 27.5C18.2 29.4 25.2 25.2 31.5 21.5Z"
        fill="url(#ribbonSilk)"
        stroke="#D6336C"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <path
        d="M32.5 21.5C39.5 14 50 7 56.5 11.5C62 15.3 59.5 25.5 52.5 27.5C45.8 29.4 38.8 25.2 32.5 21.5Z"
        fill="url(#ribbonSilk)"
        stroke="#D6336C"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <path
        d="M28 24.5L18 40L24.5 36.5L28 41.5L31 26"
        fill="url(#ribbonTail)"
        stroke="#D6336C"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <path
        d="M36 24.5L46 40L39.5 36.5L36 41.5L33 26"
        fill="url(#ribbonTail)"
        stroke="#D6336C"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <circle cx="32" cy="21.5" r="4.8" fill="#E64980" stroke="#FFF6F9" stroke-width="1.6" />
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
      width="84"
      height="84"
      viewBox="0 0 84 84"
      fill="none"
      aria-hidden="true"
      class="pointer-events-none select-none ambient-float"
    >
      <circle cx="58" cy="20" r="6" fill="#FBCFE8" opacity="0.78" />
      <circle cx="67" cy="27" r="4.5" fill="#F9A8D4" opacity="0.65" />
      <circle cx="51" cy="28" r="4.5" fill="#F9A8D4" opacity="0.65" />
      <circle cx="59" cy="24.5" r="2.5" fill="#E64980" opacity="0.88" />
      <circle cx="38" cy="14" r="2.2" fill="#F472B6" opacity="0.5" />
      <circle cx="71" cy="43" r="2.2" fill="#F472B6" opacity="0.5" />
      <path
        d="M22 10C36 9 48 12 58 18"
        stroke="#F472B6"
        stroke-width="1.25"
        stroke-linecap="round"
        stroke-dasharray="3 4"
        opacity="0.58"
      />
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
        <defs>
          <linearGradient id="ringRoseGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FB7185" />
            <stop offset="100%" stop-color="#E11D48" />
          </linearGradient>
        </defs>
        <circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          stroke="#FCE7F3"
          stroke-width="5"
        />
        <circle
          cx="24"
          cy="24"
          r="19"
          fill="none"
          stroke="url(#ringRoseGrad)"
          stroke-width="5"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="dashOffset()"
          class="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span class="absolute text-[11px] font-mono font-bold text-rose-950 tabular-nums">
        {{ clampedPct() }}%
      </span>
    </div>
  `,
})
export class KawaiiProgressRing {
  readonly pct = input<number>(0);
  readonly size = input<number>(52);

  protected readonly circumference = 2 * Math.PI * 19;
  protected readonly clampedPct = computed(() => Math.max(0, Math.min(100, Math.round(this.pct()))));
  protected readonly dashOffset = computed(
    () => this.circumference - (this.clampedPct() / 100) * this.circumference,
  );
}
