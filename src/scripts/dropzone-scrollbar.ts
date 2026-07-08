type ScrollbarParts = {
  bar: HTMLElement;
  track: HTMLElement;
  thumb: HTMLElement;
};

const scrollbarControllers = new WeakMap<HTMLElement, AbortController>();

function ensureCustomScrollbar(container: HTMLElement): ScrollbarParts {
  let bar = container.querySelector<HTMLElement>("[data-dropzone-scrollbar]");
  if (!bar) {
    bar = document.createElement("div");
    bar.dataset.dropzoneScrollbar = "";
    bar.className = "dropzone-custom-scrollbar hidden";
    bar.setAttribute("aria-hidden", "true");

    const track = document.createElement("div");
    track.className = "dropzone-custom-scrollbar__track";
    track.dataset.dropzoneScrollbarTrack = "";

    const thumb = document.createElement("div");
    thumb.className = "dropzone-custom-scrollbar__thumb";
    thumb.dataset.dropzoneScrollbarThumb = "";

    track.appendChild(thumb);
    bar.appendChild(track);
    container.appendChild(bar);
  }

  const track = bar.querySelector<HTMLElement>("[data-dropzone-scrollbar-track]");
  const thumb = bar.querySelector<HTMLElement>("[data-dropzone-scrollbar-thumb]");
  if (!track || !thumb) {
    throw new Error("Custom scrollbar elements missing");
  }

  return { bar, track, thumb };
}

function hideCustomScrollbar(preview: HTMLElement): void {
  preview.querySelector<HTMLElement>("[data-dropzone-scrollbar]")?.classList.add("hidden");
}

export function teardownDropzoneScrollbar(thumbs: HTMLElement): void {
  scrollbarControllers.get(thumbs)?.abort();
  scrollbarControllers.delete(thumbs);
}

function bindThumbDrag(
  thumbs: HTMLElement,
  track: HTMLElement,
  thumb: HTMLElement,
  signal: AbortSignal
): void {
  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartScrollLeft = 0;
  let mouseDragging = false;

  const scrollByDelta = (deltaX: number) => {
    const trackWidth = track.clientWidth;
    const thumbWidth = thumb.offsetWidth;
    const scrollRange = trackWidth - thumbWidth;
    const maxScroll = thumbs.scrollWidth - thumbs.clientWidth;
    if (scrollRange <= 0 || maxScroll <= 0) return;

    thumbs.scrollLeft = dragStartScrollLeft + (deltaX / scrollRange) * maxScroll;
  };

  const startDrag = (clientX: number, pointerId?: number) => {
    dragStartX = clientX;
    dragStartScrollLeft = thumbs.scrollLeft;
    thumb.classList.add("is-dragging");
    if (pointerId !== undefined) dragPointerId = pointerId;
    else mouseDragging = true;
  };

  const endDrag = (pointerId?: number) => {
    if (pointerId !== undefined && dragPointerId !== pointerId) return;
    if (pointerId === undefined && !mouseDragging) return;
    dragPointerId = null;
    mouseDragging = false;
    thumb.classList.remove("is-dragging");
    if (pointerId !== undefined) {
      try {
        thumb.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  if (window.PointerEvent) {
    thumb.addEventListener(
      "pointerdown",
      event => {
        event.preventDefault();
        event.stopPropagation();
        startDrag(event.clientX, event.pointerId);
        thumb.setPointerCapture(event.pointerId);
      },
      { signal }
    );

    thumb.addEventListener(
      "pointermove",
      event => {
        if (dragPointerId !== event.pointerId) return;
        scrollByDelta(event.clientX - dragStartX);
      },
      { signal }
    );

    thumb.addEventListener("pointerup", event => endDrag(event.pointerId), { signal });
    thumb.addEventListener("pointercancel", event => endDrag(event.pointerId), {
      signal,
    });
  } else {
    thumb.addEventListener(
      "mousedown",
      event => {
        event.preventDefault();
        event.stopPropagation();
        startDrag(event.clientX);
      },
      { signal }
    );

    document.addEventListener(
      "mousemove",
      event => {
        if (!mouseDragging) return;
        scrollByDelta(event.clientX - dragStartX);
      },
      { signal }
    );

    document.addEventListener("mouseup", () => endDrag(), { signal });
  }

  track.addEventListener(
    "click",
    event => {
      if (event.target === thumb) return;
      const rect = track.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const thumbWidth = thumb.offsetWidth;
      const trackWidth = track.clientWidth;
      const scrollRange = trackWidth - thumbWidth;
      const maxScroll = thumbs.scrollWidth - thumbs.clientWidth;
      if (scrollRange <= 0 || maxScroll <= 0) return;

      const targetOffset = Math.min(
        scrollRange,
        Math.max(0, clickX - thumbWidth / 2)
      );
      thumbs.scrollLeft = (targetOffset / scrollRange) * maxScroll;
    },
    { signal }
  );
}

export function syncDropzoneScrollbar(thumbs: HTMLElement, preview: HTMLElement): void {
  try {
    const { bar, track, thumb } = ensureCustomScrollbar(preview);
    preview.appendChild(bar);

    const update = () => {
      const { scrollWidth, clientWidth, scrollLeft } = thumbs;
      const scrollable = scrollWidth > clientWidth + 2;

      bar.classList.toggle("hidden", !scrollable);
      if (!scrollable) return;

      const trackWidth = track.clientWidth;
      if (trackWidth <= 0) return;

      const ratio = clientWidth / scrollWidth;
      const thumbWidth = Math.max(64, Math.floor(trackWidth * ratio));
      const maxThumbOffset = Math.max(0, trackWidth - thumbWidth);
      const maxScroll = scrollWidth - clientWidth;
      const thumbOffset =
        maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbOffset : 0;

      thumb.style.width = `${thumbWidth}px`;
      thumb.style.transform = `translateX(${thumbOffset}px)`;
    };

    let existing = scrollbarControllers.get(thumbs);
    if (existing) {
      requestAnimationFrame(update);
      return;
    }

    const ac = new AbortController();
    scrollbarControllers.set(thumbs, ac);
    const { signal } = ac;

    thumbs.addEventListener("scroll", update, { passive: true, signal });
    window.addEventListener("resize", update, { signal });

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => update());
      resizeObserver.observe(thumbs);
      resizeObserver.observe(track);
      signal.addEventListener("abort", () => resizeObserver.disconnect());
    }

    if (typeof MutationObserver !== "undefined") {
      const mutationObserver = new MutationObserver(() => {
        requestAnimationFrame(update);
      });
      mutationObserver.observe(thumbs, { childList: true, subtree: true });
      signal.addEventListener("abort", () => mutationObserver.disconnect());
    }

    bindThumbDrag(thumbs, track, thumb, signal);

    requestAnimationFrame(update);
    setTimeout(update, 0);
    setTimeout(update, 120);
    setTimeout(update, 400);
  } catch {
    /* scrollbar is optional; never block previews */
  }
}

export function resetDropzoneScrollbar(preview: HTMLElement, thumbs?: HTMLElement): void {
  if (thumbs) teardownDropzoneScrollbar(thumbs);
  hideCustomScrollbar(preview);
}
