import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, createProject, deleteProject } from '../services/api';
import CreateProjectModal from './CreateProjectModal';
import colors from '../colors';

function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredProjectId, setHoveredProjectId] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await getProjects();
      setProjects(response.data);
    } catch (error) {
      console.error('Ошибка загрузки проектов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectName) => {
    try {
      const response = await createProject({ name: projectName });
      setProjects([...projects, response.data]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Ошибка создания проекта:', error);
      alert('Не удалось создать проект');
    }
  };

  const handleDeleteProject = async (projectId, e) => {
    e.stopPropagation();
    if (window.confirm('Вы уверены, что хотите удалить проект?')) {
      try {
        await deleteProject(projectId);
        setProjects(projects.filter(p => p.id !== projectId));
      } catch (error) {
        console.error('Ошибка удаления проекта:', error);
        alert('Не удалось удалить проект');
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Загрузка...</div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.white }}>
      <header className="py-6 shadow-sm" style={{ backgroundColor: colors.background }}>
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl font-semibold text-center" style={{ color: colors.primary }}>
            Добро пожаловать!
          </h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mt-6">
          <h2 className="text-2xl font-semibold text-center mb-10" style={{ color: colors.primary }}>
            Создайте новый проект или выберите из уже существующих
          </h2>
          
          <div className="max-w-2xl mx-auto">
            {/* Хеддер таблицы проектов */}
            <div className="rounded-t-xl py-3 px-5" style={{ backgroundColor: '#F0F4F8' }}>
              <h3 className="text-xl font-medium text-center" style={{ color: colors.primary }}>
                Проекты
              </h3>
            </div>
            
            {projects.length === 0 ? (
              <div className="rounded-b-xl py-16 px-4 text-center border" style={{ backgroundColor: colors.white, borderColor: colors.lightGray }}>
                <p className="mb-2" style={{ color: colors.secondaryText }}>Упс. Здесь пока пусто</p>
                <p className="mb-2" style={{ color: colors.secondaryText }}>Мы не нашли ни одного вашего проекта.</p>
                <p style={{ color: colors.secondaryText }}>Создайте новый проект, чтобы начать работу.</p>
              </div>
            ) : (
              <div className="border rounded-b-xl overflow-hidden" style={{ borderColor: colors.lightGray }}>
                {projects.map((project) => (
                  <div 
                    key={project.id} 
                    className="py-4 px-5 cursor-pointer transition-all hover:bg-gray-50 border-b last:border-b-0 flex justify-between items-center"
                    style={{ borderColor: colors.lightGray }}
                    onMouseEnter={() => setHoveredProjectId(project.id)}
                    onMouseLeave={() => setHoveredProjectId(null)}
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <h3 className="text-xl" style={{ color: colors.primary }}>
                      {project.name}
                    </h3>
                    {hoveredProjectId === project.id && (
                      <button
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-6 w-6" 
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          <path 
                            fillRule="evenodd" 
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" 
                            clipRule="evenodd" 
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-center mt-8">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-10 py-3 rounded-lg transition-colors font-semibold min-w-[220px] text-white"
              style={{ backgroundColor: colors.lightBlue, fontSize: '18px' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#2c5a8c'}
              onMouseLeave={(e) => e.target.style.backgroundColor = colors.lightBlue}
            >
              + Создать
            </button>
          </div>
        </div>
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}

export default ProjectList;