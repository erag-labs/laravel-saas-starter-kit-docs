<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import SectionHeading from './SectionHeading.vue';

interface Testimonial {
  name: string;
  role: string;
  review: string;
  location?: string;
  avatar?: string;
  accent: string;
  rating: number;
  sample: boolean;
}

const testimonials: Testimonial[] = [
  {
    name: 'Ashish Sharma',
    role: 'Full Stack Developer',
    review: 'The module structure is exactly how I would organise a Laravel app myself. Thin controllers, services, Data classes — I felt at home on day one.',
    location: 'India',
    accent: '#6366f1',
    rating: 5,
    sample: true,
  },
  {
    name: 'James Wilson',
    role: 'SaaS Founder',
    review: 'Database-per-tenant used to take me weeks. Here it was working before lunch.',
    location: 'United Kingdom',
    accent: '#0ea5e9',
    rating: 5,
    sample: true,
  },
  {
    name: 'Akash Nisad',
    role: 'Laravel Developer',
    review: 'Our team is split between Vue and React. Having the same backend in both kits made the choice painless.',
    location: 'India',
    accent: '#f59e0b',
    rating: 5,
    sample: true,
  },
  {
    name: 'Emma Taylor',
    role: 'Full Stack Developer',
    review: 'I picked the Svelte kit and the components feel native, not like a port. Clean runes code everywhere.',
    location: 'Australia',
    accent: '#ec4899',
    rating: 5,
    sample: true,
  },
  {
    name: 'Daniel Carter',
    role: 'Tech Lead',
    review: 'The docs explain the why, not just the how. Onboarding a new developer took an afternoon.',
    location: 'United States',
    accent: '#10b981',
    rating: 5,
    sample: true,
  },
  {
    name: 'Aditya Singh',
    role: 'Freelance Developer',
    review: 'composer setup, composer dev and I had a running multi-tenant app. The setup is genuinely that simple.',
    location: 'India',
    accent: '#8b5cf6',
    rating: 5,
    sample: true,
  },
  {
    name: 'Michael Brown',
    role: 'Backend Developer',
    review: 'Roles, permissions and invitations are already wired. That alone saved us a full sprint.',
    location: 'Canada',
    accent: '#ef4444',
    rating: 5,
    sample: true,
  },
  {
    name: 'Sophie Miller',
    role: 'Product Engineer',
    review: 'The reusable form components keep every page consistent. I stopped rewriting inputs and buttons.',
    location: 'Germany',
    accent: '#14b8a6',
    rating: 5,
    sample: true,
  },
  {
    name: 'Annu Gupta',
    role: 'Software Engineer',
    review: 'Per-domain branding and languages worked out of the box for our clients. Very thoughtful details.',
    location: 'India',
    accent: '#d946ef',
    rating: 5,
    sample: true,
  },
  {
    name: 'Alex Martin',
    role: 'Indie Hacker',
    review: 'Typed routes with Wayfinder and generated TypeScript types — refactoring no longer scares me.',
    location: 'France',
    accent: '#3b82f6',
    rating: 5,
    sample: true,
  },
  {
    name: 'Rahul Mehta',
    role: 'SaaS Founder',
    review: 'I launched my MVP weeks earlier than planned. Maintenance mode and suspension were a nice bonus.',
    location: 'India',
    accent: '#f97316',
    rating: 5,
    sample: true,
  },
  {
    name: 'Lucas Anderson',
    role: 'Laravel Developer',
    review: 'Great developer experience overall. Pest tests, Larastan and Pint are already set up and passing.',
    location: 'Sweden',
    accent: '#22c55e',
    rating: 5,
    sample: true,
  },
];

const hasSamples = computed(() => testimonials.some((testimonial) => testimonial.sample));
const loop = computed(() => [...testimonials, ...testimonials]);

const viewport = ref<HTMLElement | null>(null);
const track = ref<HTMLElement | null>(null);

const speed = 0.35;
let offset = 0;
let frame = 0;
let hovering = false;
let dragging = false;
let resumeTimer: ReturnType<typeof setTimeout> | undefined;
let pausedUntilResume = false;
let reducedMotion = false;
let startX = 0;
let startOffset = 0;

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const setWidth = () => (track.value ? track.value.scrollWidth / 2 : 0);

const normalize = () => {
  const width = setWidth();
  if (!width) {
    return;
  }
  offset = ((offset % width) + width) % width;
};

const render = () => {
  if (track.value) {
    track.value.style.transform = `translate3d(${-offset}px, 0, 0)`;
  }
};

const isPaused = () => hovering || dragging || pausedUntilResume || reducedMotion;

const tick = () => {
  if (!isPaused()) {
    offset += speed;
    normalize();
    render();
  }
  frame = requestAnimationFrame(tick);
};

const pauseThenResume = (delay: number) => {
  pausedUntilResume = true;
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    pausedUntilResume = false;
  }, delay);
};

const onMouseEnter = () => {
  hovering = true;
};

const onMouseLeave = () => {
  hovering = false;
};

const onPointerDown = (event: PointerEvent) => {
  dragging = true;
  startX = event.clientX;
  startOffset = offset;
  viewport.value?.setPointerCapture(event.pointerId);
};

const onPointerMove = (event: PointerEvent) => {
  if (!dragging) {
    return;
  }
  offset = startOffset - (event.clientX - startX);
  normalize();
  render();
};

const onPointerUp = (event: PointerEvent) => {
  if (!dragging) {
    return;
  }
  dragging = false;
  viewport.value?.releasePointerCapture(event.pointerId);
  pauseThenResume(event.pointerType === 'mouse' ? 0 : 2500);
};

const onWheel = (event: WheelEvent) => {
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
    return;
  }
  event.preventDefault();
  offset += event.deltaX;
  normalize();
  render();
  pauseThenResume(1500);
};

const onFocusIn = () => {
  pausedUntilResume = true;
};

const onFocusOut = () => {
  pausedUntilResume = false;
};

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  viewport.value?.addEventListener('wheel', onWheel, { passive: false });
  frame = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  clearTimeout(resumeTimer);
  viewport.value?.removeEventListener('wheel', onWheel);
});
</script>

<template>
  <section class="sl-section testimonials" aria-labelledby="testimonials-title">
    <div class="sl-container">
      <SectionHeading eyebrow="Testimonials" title="Trusted by 12+ Developers" lead="Developers building faster with SaaS Laravel starter kits.">
        <span id="testimonials-title">Trusted by 12+ Developers</span>
      </SectionHeading>
      <p v-if="hasSamples" class="sample-note">Sample testimonials</p>
    </div>

    <div
      ref="viewport"
      class="viewport"
      role="region"
      aria-label="Testimonials"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <ul ref="track" class="track">
        <li
          v-for="(testimonial, index) in loop"
          :key="`${testimonial.name}-${index}`"
          class="card"
          :aria-hidden="index >= testimonials.length ? 'true' : undefined"
        >
          <svg class="quote" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9.6 6C6.5 7.3 4.5 10 4.5 13.6V18h5.4v-5.4H7.2c.1-2 1.2-3.5 3.3-4.5L9.6 6Zm9 0c-3.1 1.3-5.1 4-5.1 7.6V18h5.4v-5.4h-2.7c.1-2 1.2-3.5 3.3-4.5L18.6 6Z"
              fill="currentColor"
            />
          </svg>
          <div class="stars" :aria-label="`${testimonial.rating} out of 5 stars`" role="img">
            <svg v-for="star in 5" :key="star" viewBox="0 0 20 20" :class="{ off: star > testimonial.rating }" aria-hidden="true">
              <path
                d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <p class="review">{{ testimonial.review }}</p>
          <div class="person">
            <img v-if="testimonial.avatar" :src="testimonial.avatar" :alt="testimonial.name" class="avatar" width="40" height="40" loading="lazy" />
            <span v-else class="avatar" :style="{ '--avatar-accent': testimonial.accent }" aria-hidden="true">{{ initials(testimonial.name) }}</span>
            <div class="person-meta">
              <strong>{{ testimonial.name }}</strong>
              <span>{{ testimonial.role }}<template v-if="testimonial.location"> · {{ testimonial.location }}</template></span>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.testimonials {
  overflow: hidden;
}

.sample-note {
  margin: -32px 0 32px;
  font-size: 12px;
  text-align: center;
  color: var(--vp-c-text-3);
}

.viewport {
  --gap: 20px;
  --per-view: 3.5;
  container-type: inline-size;
  position: relative;
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 0 20px;
  overflow: hidden;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
}

.viewport:active {
  cursor: grabbing;
}

.track {
  display: flex;
  width: max-content;
  margin: 0;
  padding: 0;
  list-style: none;
  will-change: transform;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: calc((100cqw - var(--gap) * (var(--per-view) - 1)) / var(--per-view));
  min-height: 236px;
  margin: 0 var(--gap) 0 0;
  padding: 24px;
  border: 1px solid var(--sl-border);
  border-radius: var(--sl-radius);
  background: var(--sl-surface);
  box-shadow: var(--sl-shadow-sm);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.card:hover {
  border-color: var(--sl-border-strong);
  box-shadow: var(--sl-shadow);
  transform: translateY(-4px);
}

.quote {
  position: absolute;
  top: 20px;
  right: 22px;
  width: 30px;
  height: 30px;
  color: var(--vp-c-brand-1);
  opacity: 0.14;
}

.stars {
  display: flex;
  gap: 3px;
  color: #f59e0b;
}

.stars svg {
  width: 16px;
  height: 16px;
}

.stars svg.off {
  color: var(--vp-c-default-soft);
}

.review {
  flex: 1;
  margin: 14px 0 20px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
}

.person {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--sl-border);
}

.avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in srgb, var(--avatar-accent, var(--vp-c-brand-1)) 70%, #fff), var(--avatar-accent, var(--vp-c-brand-1)));
  box-shadow:
    0 0 0 2px var(--sl-surface),
    0 0 0 3px color-mix(in srgb, var(--avatar-accent, var(--vp-c-brand-1)) 35%, transparent);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  object-fit: cover;
}

.person-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.person-meta strong {
  font-size: 14px;
  line-height: 1.3;
  color: var(--vp-c-text-1);
}

.person-meta span {
  overflow: hidden;
  font-size: 12.5px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vp-c-text-2);
}

@container (max-width: 960px) {
  .card {
    --per-view: 2.4;
  }
}

@container (max-width: 640px) {
  .card {
    --gap: 14px;
    --per-view: 1.1;
    min-height: 220px;
    padding: 20px;
  }
}

@media (max-width: 640px) {
  .viewport {
    padding-right: 16px;
    padding-left: 16px;
    -webkit-mask-image: none;
    mask-image: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }

  .card:hover {
    transform: none;
  }
}
</style>
