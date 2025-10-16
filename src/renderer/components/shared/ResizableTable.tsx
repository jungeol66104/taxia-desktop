import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Checkbox } from '../ui/checkbox';

export interface Column<T = any> {
  key: string;
  label: string;
  width: number;
  minWidth?: number;
  render?: (value: any, item: T) => React.ReactNode;
  editable?: boolean;
}

export interface ResizableTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  selectedItem?: T | null;
  onItemSelect?: (item: T) => void;
  getItemKey?: (item: T) => string | number;
  className?: string;
  headerClassName?: string;
  rowClassName?: string;
  selectedRowClassName?: string;
  emptyStateText?: string;
  onCellEdit?: (itemKey: string | number, columnKey: string, newValue: any) => void;
  onItemDelete?: (item: T) => void;
  checkboxes?: boolean;
  selectedCheckboxes?: (string | number)[];
  onCheckboxToggle?: (itemKey: string | number) => void;
  onSelectAll?: (selectAll: boolean) => void;
}

function ResizableTable<T = any>({
  columns: initialColumns,
  data,
  selectedItem,
  onItemSelect,
  getItemKey = (item: T, index: number) => (item as any).id || index,
  className = "",
  headerClassName = "",
  rowClassName = "",
  selectedRowClassName = "bg-blue-50",
  emptyStateText = "데이터가 없습니다.",
  onCellEdit,
  onItemDelete,
  checkboxes = false,
  selectedCheckboxes = [],
  onCheckboxToggle,
  onSelectAll
}: ResizableTableProps<T>) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    Object.fromEntries(initialColumns.map(col => [col.key, col.width]))
  );
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  // Cell editing state
  const [selectedCell, setSelectedCell] = useState<{rowKey: string | number, columnKey: string} | null>(null);
  const [editingCell, setEditingCell] = useState<{rowKey: string | number, columnKey: string} | null>(null);
  const [showInputField, setShowInputField] = useState<{rowKey: string | number, columnKey: string} | null>(null);
  const [inputVisible, setInputVisible] = useState<{rowKey: string | number, columnKey: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{visible: boolean, x: number, y: number, item: T | null}>({
    visible: false,
    x: 0,
    y: 0,
    item: null
  });

  // Flag to prevent double navigation
  const isNavigatingRef = useRef(false);


  const handleMouseDown = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    setIsResizing(true);
    setResizingColumn(columnKey);

    const startX = e.clientX;
    const startWidth = columnWidths[columnKey];
    const column = initialColumns.find(col => col.key === columnKey);
    const minWidth = column?.minWidth || 60;

    const handleMouseMove = (e: MouseEvent) => {
      const diffX = e.clientX - startX;
      const newWidth = Math.max(minWidth, startWidth + diffX);
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleCellClick = (e: React.MouseEvent, rowKey: string | number, columnKey: string, item: T) => {
    e.stopPropagation();

    // Select the row first
    onItemSelect?.(item);

    const column = initialColumns.find(col => col.key === columnKey);
    if (column?.editable) {
      // Single click: Select cell and prepare for editing with invisible input field
      const currentValue = (item as any)[columnKey] || '';
      setSelectedCell({ rowKey, columnKey });
      setEditingCell({ rowKey, columnKey });
      setEditValue(String(currentValue));
      setShowInputField({ rowKey, columnKey }); // Show input field but make it invisible initially
    } else {
      // For non-editable cells, just select
      setSelectedCell({ rowKey, columnKey });
      setEditingCell(null);
      setShowInputField(null);
    }
  };

  const handleCellDoubleClick = (e: React.MouseEvent, rowKey: string | number, columnKey: string, item: T) => {
    e.stopPropagation();

    // Select the row first
    onItemSelect?.(item);

    const column = initialColumns.find(col => col.key === columnKey);
    if (column?.editable) {
      // Double click: Show visible input field with cursor
      const currentValue = (item as any)[columnKey] || '';
      setSelectedCell({ rowKey, columnKey });
      setEditingCell({ rowKey, columnKey });
      setShowInputField({ rowKey, columnKey });
      setInputVisible({ rowKey, columnKey }); // Make input field visible
      setEditValue(String(currentValue));
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    console.log('🔧 handleEditKeyDown called:', e.key);
    if (e.key === 'Enter') {
      e.preventDefault();
      console.log('🔧 handleEditKeyDown Enter - navigating');
      saveEdit();
      isNavigatingRef.current = true;
      navigateCell('next-row');
      setTimeout(() => { isNavigatingRef.current = false; }, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      console.log('🔧 handleEditKeyDown Tab - navigating');
      saveEdit();
      isNavigatingRef.current = true;
      if (e.shiftKey) {
        navigateCell('prev-column');
      } else {
        navigateCell('next-column');
      }
      setTimeout(() => { isNavigatingRef.current = false; }, 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const debouncedSave = useCallback((rowKey: string | number, columnKey: string, value: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (onCellEdit) {
        onCellEdit(rowKey, columnKey, value);
      }
    }, 300); // 300ms debounce
  }, [onCellEdit]);

  const handleInputChange = (newValue: string) => {
    setEditValue(newValue);

    // Make input visible when user starts typing
    if (editingCell && !inputVisible) {
      setInputVisible({ rowKey: editingCell.rowKey, columnKey: editingCell.columnKey });
    }

    // Real-time debounced save for both visible and invisible editing
    if (editingCell) {
      debouncedSave(editingCell.rowKey, editingCell.columnKey, newValue);
    }
  };

  // Focus the selected cell
  useEffect(() => {
    if (selectedCell && !showInputField) {
      // Use setTimeout to ensure the cell is fully rendered
      setTimeout(() => {
        const cellElement = document.querySelector(`[data-cell-key="${selectedCell.rowKey}-${selectedCell.columnKey}"]`) as HTMLElement;
        if (cellElement) {
          cellElement.focus();
          console.log('🔧 Focusing on cell:', selectedCell.rowKey, selectedCell.columnKey);
        } else {
          console.log('🔧 Cell element not found:', selectedCell.rowKey, selectedCell.columnKey);
        }
      }, 0);
    }
  }, [selectedCell, showInputField]);

  // Focus and position cursor in input field when shown
  useEffect(() => {
    if (showInputField) {
      // Use setTimeout to ensure the input field is rendered
      setTimeout(() => {
        const inputElement = document.querySelector(`[data-cell-key="${showInputField.rowKey}-${showInputField.columnKey}"] input`) as HTMLInputElement;
        if (inputElement) {
          inputElement.focus();
          // Set cursor to end of text
          inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
        }
      }, 0);
    }
  }, [showInputField]);

  const saveEdit = () => {
    // Clear any pending debounced save
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Immediate save on blur/enter
    if (editingCell && onCellEdit) {
      onCellEdit(editingCell.rowKey, editingCell.columnKey, editValue);
    }
    setEditingCell(null);
    setShowInputField(null);
    setInputVisible(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    // Clear any pending debounced save
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setEditingCell(null);
    setShowInputField(null);
    setInputVisible(null);
    setEditValue('');
  };

  // Navigate to next/previous cell
  const navigateCell = (direction: 'next-column' | 'next-row' | 'prev-column' | 'prev-row') => {
    console.log('🔧 navigateCell called:', direction);
    if (!selectedCell) return;

    const currentRowIndex = data.findIndex(item => getItemKey(item, -1) === selectedCell.rowKey);
    const currentColIndex = initialColumns.findIndex(col => col.key === selectedCell.columnKey);

    if (currentRowIndex === -1 || currentColIndex === -1) return;

    let newRowIndex = currentRowIndex;
    let newColIndex = currentColIndex;

    switch (direction) {
      case 'next-column':
        newColIndex = (currentColIndex + 1) % initialColumns.length;
        break;
      case 'prev-column':
        newColIndex = currentColIndex === 0 ? initialColumns.length - 1 : currentColIndex - 1;
        break;
      case 'next-row':
        newRowIndex = (currentRowIndex + 1) % data.length;
        break;
      case 'prev-row':
        newRowIndex = currentRowIndex === 0 ? data.length - 1 : currentRowIndex - 1;
        break;
    }

    const newItem = data[newRowIndex];
    const newColumn = initialColumns[newColIndex];
    const newRowKey = getItemKey(newItem, newRowIndex);

    // Select the new cell and row
    setSelectedCell({ rowKey: newRowKey, columnKey: newColumn.key });
    onItemSelect?.(newItem);

    // If new cell is editable, prepare for editing with invisible input
    if (newColumn.editable) {
      const newValue = (newItem as any)[newColumn.key] || '';
      setEditingCell({ rowKey: newRowKey, columnKey: newColumn.key });
      setEditValue(String(newValue));
      setShowInputField({ rowKey: newRowKey, columnKey: newColumn.key }); // Show input field but invisible
      setInputVisible(null); // Keep input invisible until user types

      // Ensure focus is set after state updates
      setTimeout(() => {
        const inputElement = document.querySelector(`[data-cell-key="${newRowKey}-${newColumn.key}"] input`) as HTMLInputElement;
        if (inputElement) {
          inputElement.focus();
          console.log('🔧 Manually focusing on navigated input (invisible):', newRowKey, newColumn.key);
        }
      }, 20);
    } else {
      setEditingCell(null);
      setShowInputField(null);
      setInputVisible(null);
      setEditValue('');
    }
  };

  // Handle keyboard input when cell is selected (simplified since we always have input field)
  const handleKeyPress = (e: React.KeyboardEvent, rowKey: string | number, columnKey: string) => {
    // Since we now always have an input field for editable cells, most logic is handled by the input field
    // We only need to handle navigation keys and special keys for non-input scenarios

    if (e.key === 'Escape') {
      // Escape to cancel selection
      setSelectedCell(null);
      setEditingCell(null);
      setShowInputField(null);
      setInputVisible(null);
      setEditValue('');
    }
  };

  const handleRowClick = (item: T) => {
    // Clear cell selection when clicking on row (but not on cells)
    setSelectedCell(null);
    setEditingCell(null);
    setShowInputField(null);
    onItemSelect?.(item);
  };

  const handleContextMenu = (e: React.MouseEvent, item: T) => {
    if (onItemDelete) {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        item
      });
    }
  };

  const handleClickOutside = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Add click outside listener
  useEffect(() => {
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  return (
    <div className={`flex-1 overflow-auto ${className} flex flex-col relative`}>
      <table className="w-full text-sm" style={{ tableLayout: 'auto', minWidth: '100%' }}>
        <thead className={`bg-gray-100 border-b border-gray-200 sticky top-0 z-40 ${headerClassName}`}>
          <tr>
            {checkboxes && (
              <th
                className="px-3 py-2 font-medium text-gray-700 relative border-r border-gray-200"
                style={{ width: '40px', minWidth: '40px' }}
              >
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={data.length > 0 && selectedCheckboxes.length === data.length}
                    onCheckedChange={(checked) => {
                      onSelectAll?.(checked === true);
                    }}
                  />
                </div>
              </th>
            )}
            {initialColumns.map((column, index) => {
              const isLastColumn = index === initialColumns.length - 1;
              const width = columnWidths[column.key];

              return (
                <th
                  key={column.key}
                  className={`text-left px-3 py-2 font-medium text-gray-700 relative ${
                    !isLastColumn ? 'border-r border-gray-200' : ''
                  }`}
                  style={{
                    width: isLastColumn ? 'auto' : `${width}px`,
                    minWidth: isLastColumn ? `${width}px` : `${width}px`
                  }}
                >
                  {column.label}
                  {!isLastColumn && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300 transition-colors"
                      style={{
                        backgroundColor: resizingColumn === column.key ? '#93c5fd' : 'transparent',
                        zIndex: 5
                      }}
                      onMouseDown={(e) => handleMouseDown(e, column.key)}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const isSelected = selectedItem && getItemKey(selectedItem, -1) === getItemKey(item, index);
            const rowKey = getItemKey(item, index);

            return (
              <tr
                key={rowKey}
                className={`hover:bg-blue-50 cursor-pointer border-b border-gray-100 ${
                  isSelected ? selectedRowClassName : 'bg-white'
                } ${rowClassName}`}
                onClick={() => handleRowClick(item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
              >
                {checkboxes && (
                  <td
                    className="px-1 py-1 border-r border-gray-200"
                    style={{ width: '40px', minWidth: '40px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 flex items-center justify-center" style={{ minHeight: '30px' }}>
                      <Checkbox
                        checked={selectedCheckboxes.includes(rowKey)}
                        onCheckedChange={() => onCheckboxToggle?.(rowKey)}
                        onClick={(e: any) => e.stopPropagation()}
                      />
                    </div>
                  </td>
                )}
                {initialColumns.map((column, colIndex) => {
                  const isLastColumn = colIndex === initialColumns.length - 1;
                  const width = columnWidths[column.key];
                  const value = (item as any)[column.key];
                  const isCellSelected = selectedCell?.rowKey === rowKey && selectedCell?.columnKey === column.key;
                  const isCellEditing = editingCell?.rowKey === rowKey && editingCell?.columnKey === column.key;
                  const showInput = showInputField?.rowKey === rowKey && showInputField?.columnKey === column.key;

                  return (
                    <td
                      key={column.key}
                      data-cell-key={`${rowKey}-${column.key}`}
                      className={`px-1 py-1 ${
                        !isLastColumn ? 'border-r border-gray-200' : ''
                      } ${isCellSelected ? 'bg-blue-100' : ''} ${
                        column.editable ? 'cursor-cell' : ''
                      }`}
                      style={{
                        ...(isCellSelected && {
                          boxShadow: 'inset 0 0 0 2px #2563eb',
                          position: 'relative',
                          zIndex: 40,
                          isolation: 'isolate'
                        }),
                        width: isLastColumn ? 'auto' : `${width}px`,
                        minWidth: isLastColumn ? `${width}px` : `${width}px`,
                        maxWidth: isLastColumn ? 'none' : `${width}px`,
                        minHeight: '32px',
                        outline: 'none' // Remove default focus outline
                      }}
                      onClick={(e) => handleCellClick(e, rowKey, column.key, item)}
                      onDoubleClick={(e) => handleCellDoubleClick(e, rowKey, column.key, item)}
                      onKeyDown={(e) => handleKeyPress(e, rowKey, column.key)}
                      tabIndex={isCellSelected ? 0 : -1} // Make selected cell focusable
                    >
                      <div style={{ position: 'relative', minHeight: '30px' }}>
                        {/* Always show the content div */}
                        <div
                          className={`px-2 py-1 ${isLastColumn ? '' : 'truncate'}`}
                          style={{
                            minHeight: '30px',
                            display: 'flex',
                            alignItems: 'center',
                            ...(isLastColumn ? {
                              whiteSpace: 'nowrap'
                            } : {
                              width: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }),
                            // Hide content when input is visible
                            visibility: showInput && inputVisible?.rowKey === rowKey && inputVisible?.columnKey === column.key ? 'hidden' : 'visible'
                          }}
                        >
                          {column.render ? column.render(value, item) : (value || '\u00A0')}
                        </div>

                        {/* Input field overlay for editable cells */}
                        {showInput && (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            onBlur={saveEdit}
                            className="absolute inset-0 w-full h-full px-2 py-1 border-0 outline-none text-sm"
                            style={{
                              minHeight: '30px',
                              background: 'transparent',
                              // Only show input text when it's supposed to be visible
                              color: inputVisible?.rowKey === rowKey && inputVisible?.columnKey === column.key ? 'inherit' : 'transparent',
                              caretColor: inputVisible?.rowKey === rowKey && inputVisible?.columnKey === column.key ? 'auto' : 'transparent'
                            }}
                          />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="text-gray-500 text-sm">{emptyStateText}</div>
        </div>
      )}

      {/* Context menu with matching shadcn dropdown styling */}
      {contextMenu.visible && onItemDelete && (
        <div
          className="fixed z-[9999] bg-white rounded-md border-[#ededed] border shadow-md p-1 min-w-[8rem]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 w-full text-left text-red-600 hover:text-red-600"
            onClick={() => {
              if (contextMenu.item) {
                onItemDelete(contextMenu.item);
              }
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

export default ResizableTable;