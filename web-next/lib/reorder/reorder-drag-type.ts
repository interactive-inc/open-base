/**
 * 並べ替えドラッグで dataTransfer に載せる MIME タイプ。
 * dragover では値を読めず types しか見られないため、専用タイプで自分のドラッグだけを受け付ける
 */
export const REORDER_DRAG_TYPE = "application/x-reorder-index"
