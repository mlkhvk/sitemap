import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Menu,
  Undo2,
  Pencil,
  Trash2
} from 'lucide-react';
import AddPageModal from './AddPageModal';
import colors from '../colors';
import { getPages, getProjects, createPage, deletePage, updatePage, getElements } from '../services/api';

function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState(null);

  const fetchProjectData = useCallback(async () => {
    try {
      const projectsRes = await getProjects();
      const foundProject = projectsRes.data.find(
        p => p.id === parseInt(projectId)
      );
      setProject(foundProject);
      const pagesRes = await getPages(projectId);
      setPages(pagesRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Функция для построения дерева страниц
  const buildPageTree = (pages) => {
    const pageMap = {};
    pages.forEach(page => {
      pageMap[page.id] = {
        ...page,
        children: []
      };
    });

    const tree = [];
    pages.forEach(page => {
      if (page.parent_page_id) {
        if (pageMap[page.parent_page_id]) {
          pageMap[page.parent_page_id].children.push(pageMap[page.id]);
        }
      } else {
        tree.push(pageMap[page.id]);
      }
    });

    return tree;
  };

  // Функция для рендеринга карты сайта
  const renderSitemap = (pages, level = 0) => {
    const sortedPages = [...pages].sort((a, b) => {
      if (a.sort_order !== undefined && b.sort_order !== undefined) {
        return a.sort_order - b.sort_order;
      }
      return a.title.localeCompare(b.title);
    });

    return sortedPages.map((page) => {
      const hasChildren = page.children && page.children.length > 0;
      const isRoot = level === 0;
      
      return (
        <div key={page.id}>
          <div 
            className="py-1 flex items-center"
            style={{ 
              paddingLeft: `${level * 20}px`,
              color: colors.primary
            }}
          >
            {/* Точка только у дочерних элементов (не у корневых) */}
            {!isRoot && (
              <span style={{ marginRight: '8px', color: colors.primary }}>•</span>
            )}
            <span 
              style={{ 
                fontSize: isRoot ? '20px' : '18px',
                fontWeight: isRoot ? '600' : '400',
                color: colors.primary
              }}
            >
              {page.title}
            </span>
          </div>
          {hasChildren && (
            <div>
              {renderSitemap(page.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const handleAddPage = async (pageData) => {
    try {
      const pageForBackend = {
        title: pageData.title,
        links: pageData.links.map(link => ({ url: link })),
        elements: pageData.elements.map(el => ({
          name: el.name,
          parent_element_id: null,
          children: el.children.map(child => ({ name: child.name }))
        }))
      };
      
      await createPage(projectId, pageForBackend);
      await fetchProjectData();
    } catch (error) {
      console.error('Ошибка создания страницы:', error);
      alert('Не удалось создать страницу');
    }
  };

  const transformElementsForModal = (elements) => {
    const buildTree = (items, parentId = null) => {
      const result = [];
      const children = items.filter(item => item.parent_id === parentId);
      
      for (const child of children) {
        result.push({
          id: child.id,
          name: child.name,
          parentId: child.parent_id,
          children: buildTree(items, child.id)
        });
      }
      
      return result;
    };
    
    return buildTree(elements);
  };

  const handleEditPage = async (page) => {
    try {
      const elementsRes = await getElements(page.id);
      const elements = elementsRes.data;
      
      const links = page.links?.map(link => link.url) || [''];
      
      const transformedElements = transformElementsForModal(elements);
      
      setEditingPage({
        id: page.id,
        title: page.title,
        links: links,
        elements: transformedElements
      });
      setIsAddModalOpen(true);
    } catch (error) {
      console.error('Ошибка загрузки данных страницы:', error);
      alert('Не удалось загрузить данные страницы');
    }
  };

  const handleUpdatePageData = async (pageData) => {
    try {
      const pageForBackend = {
        title: pageData.title,
        links: pageData.links.map(link => ({ url: link }))
      };
      
      await updatePage(editingPage.id, pageForBackend);
      await fetchProjectData();
      setEditingPage(null);
    } catch (error) {
      console.error('Ошибка обновления страницы:', error);
      alert('Не удалось обновить страницу');
    }
  };

  const handleDeletePage = async (pageId, e) => {
    e.stopPropagation();
    if (window.confirm('Вы уверены, что хотите удалить эту страницу?')) {
      try {
        await deletePage(pageId);
        await fetchProjectData();
      } catch (error) {
        console.error('Ошибка удаления страницы:', error);
        alert('Не удалось удалить страницу');
      }
    }
  };

  const handleModalClose = (shouldRefresh = false) => {
    setIsAddModalOpen(false);
    setEditingPage(null);
    if (shouldRefresh) {
      fetchProjectData();
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Загрузка...
      </div>
    );
  }

  const pageTree = buildPageTree(pages);

  return (
    <div className="min-h-screen p-3">
      <div 
        className="rounded-2xl overflow-hidden border min-h-[95vh] relative"
        style={{ borderColor: colors.lightGray }}
      >
        {/* LEFT SIDEBAR */}
        <aside 
          className={`fixed left-3 top-3 h-[calc(100vh-1.5rem)] z-10 transition-all duration-300 overflow-hidden ${
            isSidebarOpen ? 'w-[320px]' : 'w-0'
          } border rounded-2xl`}
          style={{ borderColor: colors.lightGray, backgroundColor: colors.blue }}
        >
          <div className="w-[320px] h-full flex flex-col">
            <div className="px-5 pt-5 flex items-center gap-4">
              <button onClick={toggleSidebar}>
                <Menu size={28} className="text-black" />
              </button>
              <button onClick={() => navigate('/')}>
                <Undo2 size={28} className="text-black" />
              </button>
            </div>
            <div className="mt-8 px-4 text-xl" style={{ color: colors.primary }}>
              <div className="font-semibold mb-2">
                Структура сайта
              </div>
              <ul className="space-y-2 text-xl" style={{ color: colors.primary }}>
                <li className="flex items-center gap-2">
                  <span>•</span>
                  <span>Страницы</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>•</span>
                  <span>Карта</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>•</span>
                  <span>События</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>•</span>
                  <span>Чеклисты</span>
                </li>
              </ul>
              <div className="mt-5 font-semibold text-xl" style={{ color: colors.primary }}>
                Результат
              </div>
              <ul className="mt-2">
                <li className="flex items-center gap-2 text-xl" style={{ color: colors.primary }}>
                  <span>•</span>
                  <span>Генерация PDF</span>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {!isSidebarOpen && (
          <div className="fixed left-3 top-3 z-10 flex items-center gap-2">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg"
            >
              <Menu size={28} className="text-black" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="rounded-lg"
            >
              <Undo2 size={28} className="text-black" />
            </button>
          </div>
        )}
        
        <div
          className="h-[70px] flex items-center justify-center px-10 border-b w-full"
          style={{
            borderBottomColor: colors.lightGray, backgroundColor: colors.background
          }}
        >
          <h1
            className="text-2xl font-semibold"
            style={{ color: colors.primary }}
          >
            {project?.name}
          </h1>
        </div>

        <main
          className={`flex-1 flex flex-col transition-all duration-300 ${
            isSidebarOpen ? 'ml-[340px]' : 'ml-[70px]'
          }`}
        >
          <div className="mt-10">
            {/* Заголовок + кнопка */}
            <div className="w-full max-w-[720px] mx-auto mb-7 grid grid-cols-3 items-center">
              <div></div>
              <div className="flex justify-center">
                <h2
                  className="text-2xl font-semibold text-black"
                  
                >
                  Страницы сайта
                </h2>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setEditingPage(null);
                    setIsAddModalOpen(true);
                  }}
                  className="text-white font-semibold text-lg px-4 py-1.5 rounded-xl transition-colors duration-100"
                  style={{ backgroundColor: colors.primary }}
                >
                  + Добавить страницу
                </button>
              </div>
            </div>

            {/* Таблица */}
            <div className="w-full max-w-[720px] mx-auto">
              <table
                className="w-full border border-collapse bg-white"
                style={{ borderColor: colors.lightGray }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#eef2f6' }}>
                    <th
                      className="border px-4 py-3 text-xl font-semibold text-left w-[240px]"
                      style={{
                        borderColor: colors.lightGray,
                        color: colors.primary,
                      }}
                    >
                      Название
                    </th>
                    <th
                      className="border px-4 py-3 text-xl font-semibold text-left"
                      style={{
                        borderColor: colors.lightGray,
                        color: colors.primary,
                      }}
                    >
                      Ссылки
                    </th>
                    <th
                      className="border w-[44px]"
                      style={{ borderColor: colors.lightGray }}
                    ></th>
                    <th
                      className="border w-[44px]"
                      style={{ borderColor: colors.lightGray }}
                    ></th>
                  </tr>
                </thead>

                <tbody>
                  {pages.map((page) => (
                    <tr key={page.id}>
                      <td
                        className="border px-4 py-3 text-lg"
                        style={{
                          borderColor: colors.lightGray,
                          color: colors.primary,
                        }}
                      >
                        <button
                          onClick={() => navigate(`/project/${projectId}/page/${page.id}`)}
                          className="hover:text-blue-600 hover:underline transition-colors cursor-pointer text-left w-full"
                          style={{ color: colors.primary }}
                        >
                          {page.title}
                        </button>
                      </td>
                      <td
                        className="border px-4 py-3 text-lg"
                        style={{
                          borderColor: colors.lightGray,
                          color: colors.primary,
                        }}
                      >
                        {page.links?.map((link, idx) => (
                          <div key={idx}>{link.url}</div>
                        ))}
                      </td>
                      <td
                        className="border text-center"
                        style={{ borderColor: colors.lightGray }}
                      >
                        <button 
                          onClick={() => handleEditPage(page)}
                          className="hover:text-blue-600 transition"
                        >
                          <Pencil size={18} />
                        </button>
                      </td>
                      <td
                        className="border text-center"
                        style={{ borderColor: colors.lightGray }}
                      >
                        <button 
                          className="hover:text-red-500 transition"
                          onClick={(e) => handleDeletePage(page.id, e)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {pages.length === 0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="text-center py-6"
                        style={{ color: colors.secondaryText }}
                      >
                        Нет добавленных страниц
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* КАРТА САЙТА */}
            <div className="mt-10 w-full max-w-[720px] mx-auto">
              <h2
                className="text-2xl font-semibold mb-6 text-center text-black"
                
              >
                Карта сайта
              </h2>
              
              <div className="border rounded-lg p-6" style={{ borderColor: colors.lightGray }}>
                {pages.length === 0 ? (
                  <div className="text-center py-8" style={{ color: colors.secondaryText }}>
                    Нет страниц для отображения карты сайта
                  </div>
                ) : (
                  <div className="sitemap-tree">
                    {renderSitemap(pageTree)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <AddPageModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onSave={editingPage ? handleUpdatePageData : handleAddPage}
        onSavePage={editingPage ? updatePage : createPage}
        projectId={projectId}
        editingPage={editingPage}
      />
    </div>
  );
}

export default ProjectPage;