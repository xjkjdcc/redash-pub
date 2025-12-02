import React from "react";
import PropTypes from "prop-types";
import Link from "@/components/Link";

export default function QueryResultsLink(props) {
  let href = "";

  const { query, queryResult, fileType, disabled: propDisabled } = props;
  const resultId = queryResult.getId && queryResult.getId();
  const resultData = queryResult.getData && queryResult.getData();

  // 增强href生成逻辑，确保所有必要条件都满足
  if (query && query.id && query.name && queryResult && resultId && resultData) {
    href = `/api/queries/${query.id}/results/${resultId}.${fileType}${props.embed ? `?api_key=${props.apiKey}` : ""}`;
  }

  // 当href为空时，自动禁用链接
  const isDisabled = propDisabled || !href;

  return (
    <Link target="_self" disabled={isDisabled} href={href} download>
      {props.children}
    </Link>
  );
}

QueryResultsLink.propTypes = {
  query: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  queryResult: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  fileType: PropTypes.string,
  disabled: PropTypes.bool.isRequired,
  embed: PropTypes.bool,
  apiKey: PropTypes.string,
  children: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]).isRequired,
};

QueryResultsLink.defaultProps = {
  queryResult: {},
  fileType: "csv",
  embed: false,
  apiKey: "",
};
