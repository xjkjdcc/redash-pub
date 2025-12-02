import React, { useState } from "react";
import PropTypes from "prop-types";
import { compact, isEmpty, invoke, map } from "lodash";
import { markdown } from "markdown";
import cx from "classnames";
import Menu from "antd/lib/menu";
import HtmlContent from "@redash/viz/lib/components/HtmlContent";
import { currentUser } from "@/services/auth";
import recordEvent from "@/services/recordEvent";
import { formatDateTime } from "@/lib/utils";
import Link from "@/components/Link";
import Parameters from "@/components/Parameters";
import TimeAgo from "@/components/TimeAgo";
import Timer from "@/components/Timer";
import { Moment } from "@/components/proptypes";
import QueryLink from "@/components/QueryLink";
import { FiltersType } from "@/components/Filters";
import PlainButton from "@/components/PlainButton";
import ExpandedWidgetDialog from "@/components/dashboards/ExpandedWidgetDialog";
import EditParameterMappingsDialog from "@/components/dashboards/EditParameterMappingsDialog";
import VisualizationRenderer from "@/components/visualizations/VisualizationRenderer";

import Widget from "./Widget";

function visualizationWidgetMenuOptions({ widget, canEditDashboard, onParametersEdit, apiKey: propApiKey, isPublic }) {
  const canViewQuery = currentUser.hasPermission("view_query");
  const parametersDefs = invoke(widget, "query.getParametersDefs");
  const canEditParameters = canEditDashboard && !isEmpty(parametersDefs);
  const widgetQueryResult = widget.getQueryResult();
  // 安全检查：确保 widgetQueryResult 有 isEmpty 方法
  const isQueryResultEmpty = !widgetQueryResult || typeof widgetQueryResult.isEmpty !== 'function' || widgetQueryResult.isEmpty();
  
  // 在Public模式下，从查询对象获取API密钥
  const query = widget.getQuery();
  const apiKey = propApiKey || (isPublic && query ? query.api_key : null);
  
  // 安全地生成下载链接，为public模式优化
  const downloadLink = fileType => {
    try {
      if (!query || !query.id) {
        console.error('下载链接生成失败: 查询对象不存在或缺少ID');
        return '#';
      }
      
      // 使用正确的API格式：匹配后端路由 /api/queries/<query_id>/results.<filetype>
      let link = `/api/queries/${query.id}/results.${fileType}`;
      
      // 在public模式下必须添加apiKey
      if (apiKey) {
        link = `${link}?api_key=${apiKey}`;
        // console.log(`Public模式下载链接: ${link}`);
      } else if (isPublic) {
        // console.error('Public模式下缺少apiKey，下载可能失败');
      }
      
      return link;
    } catch (error) {
      // console.error('生成下载链接时出错:', error);
      return '#';
    }
  };
  
  // 生成下载文件名
  const downloadName = fileType => {
    try {
      if (!query || !query.name) {
        return `download_${Date.now()}.${fileType}`;
      }
      // 安全检查：确保 widgetQueryResult 有 getName 方法
      if (typeof widgetQueryResult.getName === 'function') {
        return widgetQueryResult.getName(query.name, fileType);
      } else {
        return `${query.name.replace(/ /g, '_')}_${Date.now()}.${fileType}`;
      }
    } catch (error) {
      console.error('生成下载文件名时出错:', error);
      return `download_${Date.now()}.${fileType}`;
    };
  }

  return compact([
    // 下载选项 - 无论是否为public模式都显示
    <Menu.Item key="download_csv" disabled={isQueryResultEmpty}>
      {!isQueryResultEmpty ? (
        <Link href={downloadLink("csv")} download={downloadName("csv")} target="_self">
          Download as CSV File
        </Link>
      ) : (
        "Download as CSV File"
      )}
    </Menu.Item>,
    <Menu.Item key="download_tsv" disabled={isQueryResultEmpty}>
      {!isQueryResultEmpty ? (
        <Link href={downloadLink("tsv")} download={downloadName("tsv")} target="_self">
          Download as TSV File
        </Link>
      ) : (
        "Download as TSV File"
      )}
    </Menu.Item>,
    <Menu.Item key="download_excel" disabled={isQueryResultEmpty}>
      {!isQueryResultEmpty ? (
        <Link href={downloadLink("xlsx")} download={downloadName("xlsx")} target="_self">
          Download as Excel File
        </Link>
      ) : (
        "Download as Excel File"
      )}
    </Menu.Item>,
    
    // 根据权限和设置添加查询链接和编辑参数选项（仅在非public模式下显示）
    !isPublic && (canViewQuery || canEditParameters) && <Menu.Divider key="divider" />,
    !isPublic && canViewQuery && (
      <Menu.Item key="view_query">
        <Link href={widget.getQuery().getUrl(true, widget.visualization.id)}>View Query</Link>
      </Menu.Item>
    ),
    !isPublic && canEditParameters && (
      <Menu.Item key="edit_parameters" onClick={onParametersEdit}>
        Edit Parameters
      </Menu.Item>
    ),
  ]);
}

function RefreshIndicator({ refreshStartedAt }) {
  return (
    <div className="refresh-indicator">
      <div className="refresh-icon">
        <i className="zmdi zmdi-refresh zmdi-hc-spin" aria-hidden="true" />
        <span className="sr-only">Refreshing...</span>
      </div>
      <Timer from={refreshStartedAt} />
    </div>
  );
}

RefreshIndicator.propTypes = { refreshStartedAt: Moment };
RefreshIndicator.defaultProps = { refreshStartedAt: null };

function VisualizationWidgetHeader({
  widget,
  refreshStartedAt,
  parameters,
  isEditing,
  onParametersUpdate,
  onParametersEdit,
}) {
  const canViewQuery = currentUser.hasPermission("view_query");

  return (
    <>
      <RefreshIndicator refreshStartedAt={refreshStartedAt} />
      <div className="t-header widget clearfix">
        <div className="th-title">
          <p>
            <QueryLink query={widget.getQuery()} visualization={widget.visualization} readOnly={!canViewQuery} />
          </p>
          {!isEmpty(widget.getQuery().description) && (
            <HtmlContent className="text-muted markdown query--description">
              {markdown.toHTML(widget.getQuery().description || "")}
            </HtmlContent>
          )}
        </div>
      </div>
      {!isEmpty(parameters) && (
        <div className="m-b-10">
          <Parameters
            parameters={parameters}
            sortable={isEditing}
            appendSortableToParent={false}
            onValuesChange={onParametersUpdate}
            onParametersEdit={onParametersEdit}
          />
        </div>
      )}
    </>
  );
}

VisualizationWidgetHeader.propTypes = {
  widget: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  refreshStartedAt: Moment,
  parameters: PropTypes.arrayOf(PropTypes.object),
  isEditing: PropTypes.bool,
  onParametersUpdate: PropTypes.func,
  onParametersEdit: PropTypes.func,
};

VisualizationWidgetHeader.defaultProps = {
  refreshStartedAt: null,
  onParametersUpdate: () => {},
  onParametersEdit: () => {},
  isEditing: false,
  parameters: [],
};

function VisualizationWidgetFooter({ widget, isPublic, onRefresh, onExpand, hideActions }) {
  const widgetQueryResult = widget.getQueryResult();
  const updatedAt = invoke(widgetQueryResult, "getUpdatedAt");
  const [refreshClickButtonId, setRefreshClickButtonId] = useState();

  const refreshWidget = buttonId => {
    if (!refreshClickButtonId) {
      setRefreshClickButtonId(buttonId);
      onRefresh().finally(() => setRefreshClickButtonId(null));
    }
  };

  // 根据是否隐藏操作按钮决定显示哪些元素
  const showButtons = !hideActions;
  
  return widgetQueryResult ? (
    <>
      <span>
        {showButtons && !!widgetQueryResult && (
          <>
            {/* 刷新按钮 - 无论是public还是非public模式都显示 */}
            <PlainButton
              className="refresh-button hidden-print btn btn-sm btn-default btn-transparent m-r-5"
              onClick={() => refreshWidget(1)}
              data-test="RefreshButton"
              title="刷新数据">
              <i className={cx("zmdi zmdi-refresh", { "zmdi-hc-spin": refreshClickButtonId === 1 })} aria-hidden="true" />
              <span className="sr-only">
                {refreshClickButtonId === 1 ? "Refreshing, please wait. " : "Press to refresh. "}</span>
            </PlainButton>
            
            {/* 更新时间显示 - 只显示一次，避免重复 */}
            <TimeAgo date={updatedAt} />
          </>
        )}
        {/* 始终显示打印模式下的更新时间 */}
        <span className="visible-print">
          <i className="zmdi zmdi-time-restore" aria-hidden="true" /> {formatDateTime(updatedAt)}
        </span>
      </span>
      <span>
        {/* 移除重复的刷新按钮 */}
        {showButtons && (
          <PlainButton className="btn btn-sm btn-default hidden-print btn-transparent btn__refresh" onClick={onExpand}>
            <i className="zmdi zmdi-fullscreen" aria-hidden="true" />
          </PlainButton>
        )}
      </span>
    </>
  ) : null;
}

VisualizationWidgetFooter.propTypes = {
  widget: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  isPublic: PropTypes.bool,
  onRefresh: PropTypes.func.isRequired,
  onExpand: PropTypes.func.isRequired,
  hideActions: PropTypes.bool,
};

VisualizationWidgetFooter.defaultProps = {
  isPublic: false,
  hideActions: false,
};

class VisualizationWidget extends React.Component {
  static propTypes = {
    widget: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
    dashboard: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
    filters: FiltersType,
    isPublic: PropTypes.bool,
    isLoading: PropTypes.bool,
    canEdit: PropTypes.bool,
    isEditing: PropTypes.bool,
    onLoad: PropTypes.func,
    onRefresh: PropTypes.func,
    onDelete: PropTypes.func,
    onParameterMappingsChange: PropTypes.func,
    token: PropTypes.string,
    hideActions: PropTypes.bool,
  };

  static defaultProps = {
    filters: [],
    isPublic: false,
    isLoading: false,
    canEdit: false,
    isEditing: false,
    onLoad: () => {},
    onRefresh: () => {},
    onDelete: () => {},
    onParameterMappingsChange: () => {},
    token: null,
    hideActions: false,
  };

  constructor(props) {
    super(props);
    this.state = {
      localParameters: props.widget.getLocalParameters(),
      localFilters: props.filters,
    };
  }

  componentDidMount() {
    const { widget, onLoad } = this.props;
    recordEvent("view", "query", widget.visualization.query.id, { dashboard: true });
    recordEvent("view", "visualization", widget.visualization.id, { dashboard: true });
    onLoad();
  }

  onLocalFiltersChange = localFilters => {
    this.setState({ localFilters });
  };

  expandWidget = () => {
    ExpandedWidgetDialog.showModal({ widget: this.props.widget, filters: this.state.localFilters });
  };

  editParameterMappings = () => {
    const { widget, dashboard, onRefresh, onParameterMappingsChange } = this.props;
    EditParameterMappingsDialog.showModal({
      dashboard,
      widget,
    }).onClose(valuesChanged => {
      // refresh widget if any parameter value has been updated
      if (valuesChanged) {
        onRefresh();
      }
      onParameterMappingsChange();
      this.setState({ localParameters: widget.getLocalParameters() });
    });
  };

  renderVisualization() {
    const { widget, filters } = this.props;
    const widgetQueryResult = widget.getQueryResult();
    const widgetStatus = widgetQueryResult && widgetQueryResult.getStatus();
    switch (widgetStatus) {
      case "failed":
        return (
          <div className="body-row-auto scrollbox">
            {widgetQueryResult.getError() && (
              <div className="alert alert-danger m-5">
                Error running query: <strong>{widgetQueryResult.getError()}</strong>
              </div>
            )}
          </div>
        );
      case "done":
        return (
          <div className="body-row-auto scrollbox">
            <VisualizationRenderer
              visualization={widget.visualization}
              queryResult={widgetQueryResult}
              filters={filters}
              onFiltersChange={this.onLocalFiltersChange}
              context="widget"
            />
          </div>
        );
      default:
        return (
          <div
            className="body-row-auto spinner-container"
            role="status"
            aria-live="polite"
            aria-relevant="additions removals">
            <div className="spinner">
              <i className="zmdi zmdi-refresh zmdi-hc-spin zmdi-hc-5x" aria-hidden="true" />
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        );
    }
  }

  render() {
    const { widget, isLoading, isPublic, canEdit, isEditing, onRefresh, token, hideActions } = this.props;
    const { localParameters } = this.state;
    const widgetQueryResult = widget.getQueryResult();
    const isRefreshing = isLoading && !!(widgetQueryResult && widgetQueryResult.getStatus());
    const onParametersEdit = parameters => {
      const paramOrder = map(parameters, "name");
      widget.options.paramOrder = paramOrder;
      widget.save("options", { paramOrder });
    };

    return (
      <Widget
        {...this.props}
        className="widget-visualization"
        menuOptions={visualizationWidgetMenuOptions({
          widget,
          canEditDashboard: canEdit,
          onParametersEdit: this.editParameterMappings,
          apiKey: token,
          isPublic: isPublic,
          hideActions: hideActions,
        })}
        header={
          <VisualizationWidgetHeader
            widget={widget}
            refreshStartedAt={isRefreshing ? widget.refreshStartedAt : null}
            parameters={localParameters}
            isEditing={isEditing}
            onParametersUpdate={onRefresh}
            onParametersEdit={onParametersEdit}
          />
        }
        footer={
          <VisualizationWidgetFooter
            widget={widget}
            isPublic={isPublic}
            onRefresh={onRefresh}
            onExpand={this.expandWidget}
            hideActions={hideActions}
          />
        }
        tileProps={{ "data-refreshing": isRefreshing }}>
        {this.renderVisualization()}
      </Widget>
    );
  }
}

export default VisualizationWidget;
