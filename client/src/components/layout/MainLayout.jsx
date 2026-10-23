import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { CreateTaskModal } from '../tasks/CreateTaskModal';
import { WorkspaceInviteModal } from '../workspace/WorkspaceInviteModal';

const { Content, Sider } = Layout;

export const MainLayout = () => {
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalInitial, setTaskModalInitial] = useState({});
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  const handleOpenCreateTask = (initialData = {}) => {
    setTaskModalInitial(initialData || {});
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task) => {
    if (task) {
      setTaskModalInitial({ taskToEdit: task });
      setIsTaskModalOpen(true);
    }
  };

  const handleOpenWorkspaceModal = () => {
    setIsWorkspaceModalOpen(true);
  };

  return (
    <Layout style={{ minHeight: '100vh', height: '100vh', overflow: 'hidden' }} hasSider>
      <Sider
        width={270}
        theme="light"
        style={{
          borderRight: '1px solid #e2e8f0',
          height: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Sidebar onOpenWorkspaceInvite={handleOpenWorkspaceModal} />
      </Sider>

      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar
          onOpenCreateTask={() => handleOpenCreateTask({})}
          onOpenWorkspaceInvite={handleOpenWorkspaceModal}
        />
        <Content
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ maxWidth: 1600, margin: '0 auto', width: '100%' }}>
            <Outlet
              context={{
                openCreateTask: handleOpenCreateTask,
                openEditTask: handleOpenEditTask,
                openWorkspaceInvite: handleOpenWorkspaceModal,
              }}
            />
          </div>
        </Content>
      </Layout>

      {/* Modal Tạo/Sửa Task */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskModalInitial({});
        }}
        taskToEdit={taskModalInitial.taskToEdit}
        initialProjectId={taskModalInitial.projectId}
        initialDepartmentId={taskModalInitial.departmentId}
        onTaskCreated={() => {
          window.dispatchEvent(new Event('taskCreated'));
          window.dispatchEvent(new Event('taskUpdated'));
        }}
      />

      {/* Modal Mời thành viên & Quản lý mã Workspace */}
      <WorkspaceInviteModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />
    </Layout>
  );
};
