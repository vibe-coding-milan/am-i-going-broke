const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const start = source.indexOf('    var plotWrap = projectionChart.parentNode;');
const end = source.indexOf('\n  }\n\n  function renderProjection()', start);
assert.ok(start > 0 && end > start);

function setup({ width = 1000, hover = true } = {}) {
  const nodes = new Map();
  function node(rect = { left: 0, top: 0, right: width, bottom: 300, width, height: 300 }) {
    const classes = new Set();
    return {
      style: {}, textContent: '', disabled: false, captured: [],
      classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c),
        toggle(c, on) { if (on) classes.add(c); else classes.delete(c); } },
      getBoundingClientRect: () => rect,
      querySelector: s => nodes.get(s), querySelectorAll: () => [],
      contains(target) { return target === this || target === chart || target === inspector || target === previous || target === next || target === close; },
      setAttribute(k, v) { this[k] = v; },
      setPointerCapture(id) { this.captured.push(id); },
      focus() { document.activeElement = this; if (this.onfocus) this.onfocus(); },
    };
  }
  const wrap = node();
  const chart = node(); chart.parentNode = wrap;
  const inspector = node({ left: 0, top: 0, right: 210, bottom: 42, width: 210, height: 42 });
  const previous = node(), next = node(), close = node(), output = node(), status = node();
  inspector.contains = target => [previous, next, close].includes(target);
  const marker = node(), line = node(), circle = node();
  nodes.set('.chart-inspector', inspector); nodes.set('svg', node());
  nodes.set('#chart-inspection-value', output); nodes.set('#chart-inspection-announcement', status);
  nodes.set('#chart-previous-day', previous); nodes.set('#chart-next-day', next); nodes.set('#chart-close-inspection', close);
  nodes.set('#chart-inspection-marker', marker); nodes.set('line', line); nodes.set('circle', circle);
  const document = { querySelector: s => nodes.get(s), activeElement: null };
  const context = vm.createContext({ document, window: { innerWidth: width, innerHeight: 800, matchMedia: () => ({ matches: !hover }) },
    projectionChart: chart, containerWidth: width, width, height: 300, pad: { left: 50, right: 10 },
    chartRows: Array.from({ length: 30 }, (_, i) => ({ dateKey: `day-${i}`, balance: 1000 - i * 10 })),
    chartInspectionInput: null, chartInspectionIndex: null, lowIndex: 29,
    xFor: i => 50 + i / 29 * (width - 60), yFor: b => 200 - b / 10,
    formatProjectionHealthDate: d => d, formatCurrency: b => '$' + b,
  });
  vm.runInContext(source.slice(start, end), context);
  const event = (x, y = 150, type = 'touch') => ({ clientX: x, clientY: y, pointerId: 1, pointerType: type, button: 0 });
  return { context, chart, wrap, inspector, output, previous, next, close, status, document, event, line, circle };
}

test('mouse selects the nearest date, clamps endpoints, and keeps the card inside the viewport', () => {
  const s = setup();
  for (const x of [-100, 50, 500, 990, 1200]) {
    s.chart.onpointermove(s.event(x, 150, 'mouse'));
    assert.equal(s.wrap.classList.contains('is-inspection-docked'), false);
    const left = parseFloat(s.inspector.style.left), top = parseFloat(s.inspector.style.top);
    assert.ok(left >= 8 && left + 210 <= 992);
    assert.ok(top >= 8 && top + 42 <= 292);
    assert.ok(s.context.chartInspectionIndex >= 0 && s.context.chartInspectionIndex <= 29);
    assert.equal(s.line.x1, s.circle.cx);
  }
  assert.equal(s.output.textContent, 'day-29 · $710');
  assert.equal(s.status.textContent, '', 'mouse motion must not flood the live region');
});

test('touch tap uses a persistent external readout even on a wide tablet', () => {
  const s = setup();
  s.chart.onpointerdown(s.event(500)); s.chart.onpointerup(s.event(500));
  assert.equal(s.wrap.classList.contains('is-inspection-docked'), true);
  assert.equal(s.wrap.classList.contains('is-inspecting'), true);
  assert.equal(s.status.textContent, s.output.textContent);
  s.wrap.onpointerleave(s.event(1001));
  assert.equal(s.wrap.classList.contains('is-inspecting'), true);
  const day = s.context.chartInspectionIndex;
  s.next.onclick(); assert.equal(s.context.chartInspectionIndex, day + 1);
  s.previous.onclick(); assert.equal(s.context.chartInspectionIndex, day);
});

test('horizontal touch scrubbing captures the pointer and follows it beyond the plot', () => {
  const s = setup({ width: 393, hover: false });
  s.chart.onpointerdown(s.event(100));
  s.chart.onpointermove(s.event(200, 152));
  assert.deepEqual(s.chart.captured, [1]);
  s.chart.onpointermove(s.event(600, 152));
  s.chart.onpointerup(s.event(600, 152));
  assert.equal(s.context.chartInspectionIndex, 29);
  assert.equal(s.next.disabled, true);
  assert.equal(s.status.textContent, s.output.textContent);
});

test('vertical scrolling and pointer cancellation do not scrub or commit a new date', () => {
  const s = setup({ width: 393, hover: false });
  const initial = s.context.chartInspectionIndex;
  s.chart.onpointerdown(s.event(100)); s.chart.onpointermove(s.event(103, 210));
  s.chart.onpointercancel(); s.chart.onpointerup(s.event(103, 210));
  assert.deepEqual(s.chart.captured, []);
  assert.equal(s.context.chartInspectionIndex, initial);
  assert.equal(s.wrap.classList.contains('is-inspecting'), false);
});

test('keyboard navigation announces dates, bounds selection, and Escape restores focus from controls', () => {
  const s = setup({ width: 393 });
  const key = k => ({ key: k, preventDefault() {} });
  s.chart.onkeydown(key('Home')); assert.equal(s.context.chartInspectionIndex, 0);
  s.chart.onkeydown(key('ArrowLeft')); assert.equal(s.context.chartInspectionIndex, 0);
  s.chart.onkeydown(key('End')); assert.equal(s.context.chartInspectionIndex, 29);
  s.chart.onkeydown(key('ArrowRight')); assert.equal(s.context.chartInspectionIndex, 29);
  assert.equal(s.status.textContent, s.output.textContent);
  s.document.activeElement = s.close;
  s.wrap.onkeydown(key('Escape'));
  assert.equal(s.document.activeElement, s.chart);
  assert.equal(s.wrap.classList.contains('is-inspecting'), false);
});

test('the card remains available when moving from the plot into the tooltip; mouse can resume after touch', () => {
  const s = setup();
  s.chart.onpointerdown(s.event(300)); s.chart.onpointerup(s.event(300));
  s.chart.onpointermove(s.event(600, 150, 'mouse'));
  assert.equal(s.wrap.classList.contains('is-inspection-docked'), false);
  s.document.activeElement = s.chart;
  s.wrap.onfocusout({ relatedTarget: s.next });
  assert.equal(s.wrap.classList.contains('is-inspecting'), true);
  s.document.activeElement = null;
  s.wrap.onpointerleave(s.event(1100, 150, 'mouse'));
  assert.equal(s.wrap.classList.contains('is-inspecting'), false);
});
