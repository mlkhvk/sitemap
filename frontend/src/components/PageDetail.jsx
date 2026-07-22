// src/components/PageDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import colors from '../colors';
import { getPages, getElements, getProjects } from '../services/api';

function PageDetail() {
  const { projectId, pageId } = useParams();
  const navigate = useNavigate();
  
  const [page, setPage] = useState(null);
  const [project, setProject] = useState(null);
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPageData();
  }, [pageId, projectId]);

  const fetchPageData = async () => {
    try {
      setLoading(true);
      
      // Получаем страницу
      const pagesRes = await getPages(projectId);
      const foundPage = pagesRes.data.find(p => p.id === parseInt(pageId));
      setPage(foundPage);
      
      // Получаем проект
      const projectsRes = await getProjects();
      const foundProject = projectsRes.data.find(p => p.id === parseInt(projectId));
      setProject(foundProject);
      
      // Получаем элементы страницы
      const elementsRes = await getElements(pageId);
      setElements(elementsRes.data);
      
    } catch (error) {
      console.error('Ошибка загрузки данных страницы:', error);
    } finally {
      setLoading(false);
    }
  };

  // Функция для построения дерева элементов
  const buildElementTree = (elements) => {
    const elementMap = {};
    elements.forEach(el => {
      elementMap[el.id] = {
        ...el,
        children: []
      };
    });

    const tree = [];
    elements.forEach(el => {
      if (el.parent_element_id) {
        if (elementMap[el.parent_element_id]) {
          elementMap[el.parent_element_id].children.push(elementMap[el.id]);
        }
      } else {
        tree.push(elementMap[el.id]);
      }
    });

    return tree;
  };

  // Функция для рендеринга элементов
  const renderElements = (items, level = 0, className = '') => {
    const sortedItems = [...items].sort((a, b) => {
      if (a.sort_order !== undefined && b.sort_order !== undefined) {
        return a.sort_order - b.sort_order;
      }
      return a.name.localeCompare(b.name);
    });

    return sortedItems.map((el) => {
      const hasChildren = el.children && el.children.length > 0;
      
      return (
        <div key={el.id}>
          <div 
            className={`py-1 ${className}`}
            style={{ 
              paddingLeft: `${level * 20}px`,
              color: colors.primary
            }}
          >
            {hasChildren ? (
              <span style={{ fontWeight: '600' }}>
                {el.name}
              </span>
            ) : (
              <span>
                 {el.name}
              </span>
            )}
          </div>
          {hasChildren && (
            <div>
              {renderElements(el.children, level + 1, className)}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Загрузка...
      </div>
    );
  }

  if (!page) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl" style={{ color: colors.primary }}>Страница не найдена</p>
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            className="mt-4 px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: colors.lightBlue }}
          >
            Вернуться к проекту
          </button>
        </div>
      </div>
    );
  }

  const elementTree = buildElementTree(elements);
  const pageUrl = page.links && page.links.length > 0 ? page.links[0].url : '';

  return (
    <div className="min-h-screen p-3">
      <div 
        className="rounded-2xl overflow-hidden border min-h-[95vh]"
        style={{ borderColor: colors.lightGray, backgroundColor: colors.white }}
      >
        {/* Header с центрированным текстом и иконкой возврата справа */}
        <div className="p-6 border-b relative" style={{ borderColor: colors.lightGray, backgroundColor: colors.background }}>
          {/* Иконка возврата справа */}
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Undo2 size={28} style={{ color: colors.primary }} />
          </button>
          
          {/* Заголовок по центру */}
          <h1 
            className="text-3xl font-semibold text-center"
            style={{ color: colors.primary }}
          >
            {project?.name}
          </h1>
        </div>

        {/* Контент */}
        <div className="p-8 max-w-4xl mx-auto">
          {/* Название страницы */}
          <h1 
            className="text-3xl font-semibold mb-6 text-center"
            style={{ color: colors.primary }}
          >
            {page.title}
          </h1>

          {/* Ссылка */}
          {page.links && page.links.length > 0 && (
            <div className="mb-6">
              <span className="text-2xl">
                Ссылки: 
              </span>
              <div className="ml-12 mt-2 text-2xl">
                  {page.links.map((link, index) => (
                  <div key={index} style={{ color: colors.primary }}>
                    {link.url}
                  </div>
                ))}
              </div>
            </div>
            )}

           {/* Содержание */}
          {elements.length > 0 && (
            <div className="mb-8">
              <h2 
                className="text-2xl mb-4"
              >
                Содержание:
              </h2>
              <div className="ml-12 mt-2 text-2xl">
                {renderElements(elementTree, 0, 'text-2xl')}
              </div>
            </div>
          )}
          {/* Данные, которые могут обновляться */}
          <div>
            <h2 className="text-2xl mb-4">
              Данные, которые могут обновляться:
            </h2>
            
            <div className="pl-4">
              {/* Регулярно */}
              <div className="mb-4">
                <span 
                  className="text-2xl"
                >
                  Регулярно:
                </span>
                <div className="ml-12 mt-2 text-2xl">
                  <div style={{ color: colors.primary }}>
                    • Возраст - ежегодно 1 августа
                  </div>
                  <div style={{ color: colors.primary }}>
                    • Научная деятельность - ежегодно 1 августа
                  </div>
                </div>
              </div>

              {/* При наступлении событий */}
              <div>
                <span 
                  className="text-2xl"
                >
                  При наступлении событий:
                </span>
                <div className="ml-12 mt-2 text-2xl">
                  <div style={{ color: colors.primary }}>
                    • Вставка об общей квалификации преподавателей
                  </div>
                  <div style={{ color: colors.primary }}>
                    • События: изменение политики
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageDetail;