<script setup>
/**
 * Plain semantic reference table.
 *
 * Deliberately NOT v-data-table: these are short, fixed reference tables that
 * want no pagination, no sort state, and no virtual scroller. A real <table>
 * with <th scope="col"> is what screen readers and printers handle best, and it
 * ships no extra JS.
 */
defineProps({
  /** [{ key, title, mono?, nowrap?, width? }] */
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  /** Accessible description; rendered as a <caption> for screen readers. */
  caption: { type: String, default: "" },
  /** Row predicate marking a row as "nothing here" (rendered muted). */
  isEmpty: { type: Function, default: null },
});
</script>

<template>
  <div class="salt-scroll-x">
    <table class="salt-table">
      <caption v-if="caption" class="sr-only">{{ caption }}</caption>
      <thead>
        <tr>
          <th
            v-for="c in columns"
            :key="c.key"
            scope="col"
            :style="c.width ? `width:${c.width}` : undefined"
          >
            {{ c.title }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i" :class="{ 'is-muted': isEmpty?.(row) }">
          <td
            v-for="c in columns"
            :key="c.key"
            :class="{ mono: c.mono }"
            :style="c.nowrap ? 'white-space:nowrap' : undefined"
          >
            <slot :name="`cell.${c.key}`" :row="row" :value="row[c.key]">
              {{ row[c.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
