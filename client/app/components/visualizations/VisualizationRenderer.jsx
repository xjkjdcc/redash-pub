import { isEqual, map, find, fromPairs } from "lodash";
import React, { useState, useMemo, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import useQueryResultData from "@/lib/useQueryResultData";
import useImmutableCallback from "@/lib/hooks/useImmutableCallback";
import Filters, { FiltersType, filterData } from "@/components/Filters";
import { VisualizationType } from "@redash/viz/lib";
import { Renderer } from "@/components/visualizations/visualizationComponents";

function combineFilters(localFilters, globalFilters) {
  // tiny optimization - to avoid unnecessary updates
  if (localFilters.length === 0 || globalFilters.length === 0) {
    return localFilters;
  }

  return map(localFilters, localFilter => {
    const globalFilter = find(globalFilters, f => f.name === localFilter.name);
    if (globalFilter) {
      return {
        ...localFilter,
        current: globalFilter.current,
      };
    }
    return localFilter;
  });
}

function areFiltersEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  a = fromPairs(map(a, item => [item.name, item]));
  b = fromPairs(map(b, item => [item.name, item]));

  return isEqual(a, b);
}

export default function VisualizationRenderer(props) {
  const data = useQueryResultData(props.queryResult);
  const [filters, setFilters] = useState(() => combineFilters(data.filters, props.filters)); // lazy initialization
  const filtersRef = useRef();
  filtersRef.current = filters;

  const handleFiltersChange = useImmutableCallback(newFilters => {
    if (!areFiltersEqual(newFilters, filters)) {
      setFilters(newFilters);
      props.onFiltersChange(newFilters);
    }
  });

  // Reset local filters when query results updated
  useEffect(() => {
    handleFiltersChange(combineFilters(data.filters, props.filters));
  }, [data.filters, props.filters, handleFiltersChange]);

  // Update local filters when global filters changed.
  // For correct behavior need to watch only `props.filters` here,
  // therefore using ref to access current local filters
  useEffect(() => {
    handleFiltersChange(combineFilters(filtersRef.current, props.filters));
  }, [props.filters, handleFiltersChange]);

  // 添加安全检查，确保data对象和必要的属性存在
  const safeData = data || { columns: [], rows: [] };
  const safeColumns = safeData.columns || [];
  const safeRows = safeData.rows || [];

  const filteredData = useMemo(
    () => ({
      columns: safeColumns,
      rows: filterData(safeRows, filters),
    }),
    [safeColumns, safeRows, filters]
  );

  const { showFilters, visualization } = props;

  // 添加安全检查，确保visualization对象存在
  if (!visualization) {
    return <div>加载可视化中...</div>;
  }

  // 安全地获取选项，避免undefined错误
  const options = { ...(visualization.options || {}) };

  // define pagination size based on context for Table visualization
  if (visualization.type === "TABLE") {
    options.paginationSize = props.context === "widget" ? "small" : "default";
  }

  // 确保filters是一个数组
  const safeFilters = filters || [];
  
  // 只有在filters数组不为空且showFilters为true时才渲染Filters组件
  const renderFilters = showFilters && safeFilters.length > 0 && (
    <Filters filters={safeFilters} onChange={handleFiltersChange} />
  );
  
  // 再次增强安全检查，确保传递给Renderer的所有属性都不为undefined
  const safeKey = `visualization${visualization.id || 'loading'}`;
  const safeType = visualization.type || 'TABLE';
  const safeOptions = options || {};
  const safeFilteredData = filteredData || { columns: [], rows: [] };
  const safeVisualizationName = visualization.name || '';
  const safeAddonBefore = renderFilters;

  return (
    <Renderer
      key={safeKey}
      type={safeType}
      options={safeOptions}
      data={safeFilteredData}
      visualizationName={safeVisualizationName}
      addonBefore={safeAddonBefore}
    />
  );
}

VisualizationRenderer.propTypes = {
  visualization: VisualizationType.isRequired,
  queryResult: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  showFilters: PropTypes.bool,
  filters: FiltersType,
  onFiltersChange: PropTypes.func,
  context: PropTypes.oneOf(["query", "widget"]).isRequired,
};

VisualizationRenderer.defaultProps = {
  showFilters: true,
  filters: [],
  onFiltersChange: () => {},
};
