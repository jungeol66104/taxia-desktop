import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export interface PanelLayoutProps {
  leftPanel: {
    title: string;
    content: React.ReactNode;
    defaultSize?: number;
    minSize?: number;
  };
  rightPanel: {
    title: string;
    content: React.ReactNode;
    defaultSize?: number;
    minSize?: number;
  };
  bottomPanel?: {
    title: string;
    content: React.ReactNode;
    defaultSize?: number;
    minSize?: number;
  };
  className?: string;
}

const PanelLayout: React.FC<PanelLayoutProps> = ({
  leftPanel,
  rightPanel,
  bottomPanel,
  className = ""
}) => {
  return (
    <div className={`h-full w-full ${className}`}>
      <PanelGroup direction="horizontal">
        {/* Left Panel */}
        <Panel
          defaultSize={leftPanel.defaultSize || 70}
          minSize={leftPanel.minSize || 40}
        >
          <div className="h-full bg-white border-r border-gray-200 rounded-tl-lg rounded-bl-lg overflow-hidden flex flex-col">
            <div className="px-3 border-b border-gray-200 flex items-center flex-shrink-0" style={{ height: '48px' }}>
              <h2 className="text-xl font-semibold text-gray-800">{leftPanel.title}</h2>
            </div>
            <div className="flex-1 overflow-auto">
              {leftPanel.content}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-0.5 bg-gray-300" />

        {/* Right Panel */}
        <Panel
          defaultSize={rightPanel.defaultSize || 30}
          minSize={rightPanel.minSize || 25}
        >
          {bottomPanel ? (
            // Three-panel layout with vertical split on the right
            <PanelGroup direction="vertical">
              {/* Top Right Panel */}
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full bg-white rounded-tr-lg overflow-hidden flex flex-col">
                  <div className="px-3 border-b border-gray-200 flex items-center flex-shrink-0" style={{ height: '48px' }}>
                    <h3 className="text-xl font-semibold text-gray-800">{rightPanel.title}</h3>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {rightPanel.content}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="h-0.5 bg-gray-300" />

              {/* Bottom Right Panel */}
              <Panel
                defaultSize={bottomPanel.defaultSize || 50}
                minSize={bottomPanel.minSize || 30}
              >
                <div className="h-full bg-white rounded-br-lg overflow-hidden flex flex-col">
                  <div className="px-3 border-b border-gray-200 flex items-center flex-shrink-0" style={{ height: '48px' }}>
                    <h3 className="text-xl font-semibold text-gray-800">{bottomPanel.title}</h3>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {bottomPanel.content}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          ) : (
            // Two-panel layout
            <div className="h-full bg-white rounded-tr-lg rounded-br-lg overflow-hidden flex flex-col">
              <div className="px-3 border-b border-gray-200 flex items-center flex-shrink-0" style={{ height: '48px' }}>
                <h3 className="text-xl font-semibold text-gray-800">{rightPanel.title}</h3>
              </div>
              <div className="flex-1 overflow-auto">
                {rightPanel.content}
              </div>
            </div>
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default PanelLayout;