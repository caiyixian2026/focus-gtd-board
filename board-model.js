(function exposeBoardModel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBoardModel() {
  const MAX_COLUMNS = 12;
  const FALLBACK_COLOR = '#64748b';
  const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
  const DEFAULT_COLUMNS = Object.freeze([
    Object.freeze({ id: 'in-progress', title: '进行中任务', subtitle: '现在就行动', color: '#ef6b57' }),
    Object.freeze({ id: 'waiting', title: '等待中任务', subtitle: '等待外部反馈', color: '#2f918c' }),
    Object.freeze({ id: 'assigned', title: '分配中任务', subtitle: '交给合适的人', color: '#d69a2d' }),
    Object.freeze({ id: 'unassigned', title: '待分配任务', subtitle: '下一步要做什么？', color: '#7867c6' })
  ]);

  function createDefaultColumns() {
    return DEFAULT_COLUMNS.map(column => ({ ...column }));
  }

  function columnId() {
    return `column-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function cleanText(value, fallback, maxLength) {
    const text = typeof value === 'string' ? value.trim() : '';
    return (text || fallback).slice(0, maxLength);
  }

  function cleanColor(value) {
    return typeof value === 'string' && COLOR_PATTERN.test(value) ? value.toLowerCase() : FALLBACK_COLOR;
  }

  function normalizeColumn(column, usedIds) {
    let id = cleanText(column?.id, columnId(), 80);
    while (usedIds.has(id)) id = columnId();
    usedIds.add(id);
    return {
      id,
      title: cleanText(column?.title, '未命名栏目', 24),
      subtitle: cleanText(column?.subtitle, '', 50),
      color: cleanColor(column?.color)
    };
  }

  function normalizeColumns(rawColumns, rawTasks) {
    const sourceColumns = Array.isArray(rawColumns) && rawColumns.length
      ? rawColumns
      : createDefaultColumns();
    const tasks = Array.isArray(rawTasks) ? rawTasks : [];
    const usedIds = new Set();
    const normalizedAll = sourceColumns.map(column => normalizeColumn(column, usedIds));
    const columns = normalizedAll.slice(0, MAX_COLUMNS);
    const keptIds = new Set(columns.map(column => column.id));
    const discardedIds = new Set(normalizedAll.slice(MAX_COLUMNS).map(column => column.id));
    const unknownTasks = tasks.filter(task => !keptIds.has(task.quadrant) && !discardedIds.has(task.quadrant));
    let recoveryId = null;

    if (unknownTasks.length && columns.length < MAX_COLUMNS) {
      recoveryId = columnId();
      columns.push({ id: recoveryId, title: '待整理任务', subtitle: '由旧数据自动恢复', color: FALLBACK_COLOR });
      keptIds.add(recoveryId);
    }

    const overflowTarget = columns.at(-1)?.id;
    const normalizedTasks = tasks.map(task => {
      if (keptIds.has(task.quadrant)) return task;
      const target = discardedIds.has(task.quadrant) ? overflowTarget : (recoveryId || overflowTarget);
      return target ? { ...task, quadrant: target } : task;
    });

    return { columns: columns.length ? columns : createDefaultColumns(), tasks: normalizedTasks };
  }

  function createColumn(columns, input = {}, forcedId) {
    if (!Array.isArray(columns)) throw new Error('栏目数据无效');
    if (columns.length >= MAX_COLUMNS) throw new Error('每个页面最多创建 12 个栏目');
    const usedIds = new Set(columns.map(column => column.id));
    const requestedId = cleanText(forcedId, columnId(), 80);
    return normalizeColumn({
      id: usedIds.has(requestedId) ? columnId() : requestedId,
      title: input.title || '新栏目',
      subtitle: input.subtitle || '',
      color: input.color || FALLBACK_COLOR
    }, usedIds);
  }

  function updateColumn(columns, columnIdValue, patch = {}) {
    if (!Array.isArray(columns) || !columns.some(column => column.id === columnIdValue)) {
      throw new Error('栏目不存在');
    }
    return columns.map(column => column.id === columnIdValue ? {
      ...column,
      title: cleanText(patch.title ?? column.title, '未命名栏目', 24),
      subtitle: cleanText(patch.subtitle ?? column.subtitle, '', 50),
      color: cleanColor(patch.color ?? column.color)
    } : { ...column });
  }

  function moveColumn(columns, sourceId, targetId, placement = 'before') {
    if (!Array.isArray(columns)) throw new Error('栏目数据无效');
    const sourceIndex = columns.findIndex(column => column.id === sourceId);
    const targetIndex = columns.findIndex(column => column.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) throw new Error('栏目不存在');
    if (sourceId === targetId) return columns.map(column => ({ ...column }));
    const next = columns.map(column => ({ ...column }));
    const [source] = next.splice(sourceIndex, 1);
    const adjustedTarget = next.findIndex(column => column.id === targetId);
    const insertAt = placement === 'after' ? adjustedTarget + 1 : adjustedTarget;
    next.splice(insertAt, 0, source);
    return next;
  }

  function removeColumn(columns, tasks, columnIdValue, targetId) {
    if (!Array.isArray(columns) || columns.length <= 1) throw new Error('每个页面至少保留一个栏目');
    if (!columns.some(column => column.id === columnIdValue)) throw new Error('栏目不存在');
    const sourceTasks = (Array.isArray(tasks) ? tasks : []).filter(task => task.quadrant === columnIdValue);

    if (sourceTasks.length) {
      if (!targetId) throw new Error('请选择任务迁移目标');
      if (targetId === columnIdValue) throw new Error('请选择其他栏目');
      if (!columns.some(column => column.id === targetId)) throw new Error('迁移目标不存在');
    }

    let nextTasks = Array.isArray(tasks) ? tasks.map(task => ({ ...task })) : [];
    if (sourceTasks.length) {
      const destinationOrders = nextTasks
        .filter(task => task.quadrant === targetId)
        .map(task => Number.isFinite(task.sortOrder) ? task.sortOrder : 0);
      let nextOrder = destinationOrders.length ? Math.max(...destinationOrders) : 0;
      const orderedSourceIds = [...sourceTasks]
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
        .map(task => task.id);
      const orderById = new Map(orderedSourceIds.map(id => [id, nextOrder += 1000]));
      nextTasks = nextTasks.map(task => orderById.has(task.id)
        ? { ...task, quadrant: targetId, sortOrder: orderById.get(task.id), updatedAt: new Date().toISOString() }
        : task);
    }

    return {
      columns: columns.filter(column => column.id !== columnIdValue).map(column => ({ ...column })),
      tasks: nextTasks
    };
  }

  return {
    MAX_COLUMNS,
    DEFAULT_COLUMNS,
    createDefaultColumns,
    normalizeColumns,
    createColumn,
    updateColumn,
    moveColumn,
    removeColumn
  };
});
