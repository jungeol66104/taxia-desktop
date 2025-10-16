  const taskColumns: Column<Task>[] = [
    { key: 'startDate', label: '일자', width: 120, editable: true, render: (value) => value?.split('T')[0] || '' },
    { key: 'title', label: '제목', width: 140, editable: true },
    {
      key: 'status',
      label: '상태',
      width: 60,
      render: (status) => (
        <div className="flex justify-center">
          {status === 'completed' ? (
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
          ) : (
            <MinusCircleIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>
      )
    },
    { key: 'dueDate', label: '마감기한', width: 110, render: (value) => value?.split('T')[0]?.replace(/\./g, '-') || '' },
    {
      key: 'assignee',
      label: '담당자',
      width: 80,
      editable: false, // Disable default editing since we use custom renderer
      render: (value: string, task: Task) => (
        <AssigneeCell
          value={value}
          onChange={(newValue) => handleCellEdit(task.id, 'assignee', newValue)}
          users={users}
        />
      )
    },
    { key: 'client', label: '고객사', width: 100, editable: true },
    {
      key: 'hours',
      label: '시간',
      width: 60,
      editable: true,
      render: (value, task) => (
        <HoursCell
          value={value || 0}
          taskId={task.id}
          onChange={(newValue) => handleCellEdit(task.id, 'hours', newValue)}
        />
      )
    },
    { key: 'category', label: '카테고리', width: 100, editable: true },
    { key: 'priority', label: '우선순위', width: 80, editable: true },
    { key: 'tags', label: '태그', width: 120, editable: true },
    { key: 'description', label: '설명', width: 200, editable: true }
  ];

  if (renderError) {
    return (
      <div className="flex-1 p-4">
        <div className="text-red-600 text-center">
          <h3 className="text-lg font-semibold mb-2">Render Error</h3>
          <p className="text-sm">{String(renderError)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200">
        <button
          onClick={handleAddTask}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Task 추가
        </button>

        {/* Filter Button */}
        <div className="relative">
          <button
            ref={filterButtonRef}
            onClick={handleFilterClick}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <ListFilter className="w-4 h-4" />
            담당자 필터
          </button>

          {/* Render the extracted FilterDropdown component */}
          {showFilterDropdown && (
            <FilterDropdown
              filterDropdownPosition={filterDropdownPosition}
              updateAppliedFilters={updateAppliedFilters}
            />
          )}
        </div>

        <div className="text-sm text-gray-600">
          총 {tasks.length}개 작업
          {appliedFilters.length > 0 && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
              {appliedFilters.length}개 필터 적용됨
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Tasks Table */}
        <div className="flex-[2] min-w-0">
          <ResizableTable
            data={filteredTasks}
            columns={taskColumns}
            onRowClick={handleTaskSelect}
            onCellEdit={handleCellEdit}
            selectedRowId={selectedTask?.id}
            appliedFilters={appliedFilters}
          />
        </div>

        {/* Right Sidebar */}
        {selectedTask && (
          <div className="flex-[1] border-l border-gray-200 bg-gray-50">
            {/* Task Details Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Task Details</h3>
              <p className="text-sm text-gray-600 mt-1">{selectedTask.title}</p>
            </div>

            {/* Subtasks Section */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-800">하위 작업</h4>
                <button
                  onClick={handleAddSubtask}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + 추가
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {subtasks.map(subtask => (
                  <div
                    key={subtask.id}
                    onClick={() => setSelectedSubtask(subtask)}
                    className={`p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedSubtask?.id === subtask.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">{subtask.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      상태: {subtask.status} | 담당자: {subtask.assignee}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Messages Section */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-800">메시지</h4>
                <button
                  onClick={handleAddMessage}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + 추가
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {messages.map(message => (
                  <div key={message.id} className="p-3 rounded-md bg-white border border-gray-200">
                    <div className="text-sm text-gray-900">{message.content}</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {message.sender} • {new Date(message.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksTab;