import React, {
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react';

import {
  useParams,
  useNavigate,
} from 'react-router-dom';

import {
  Menu,
  Undo2,
  Pencil,
  Trash2,
} from 'lucide-react';

import AddPageModal from './AddPageModal';

import colors from '../colors';

import {
  getPages,
  getProjects,
  createPage,
  updatePage,
  deletePage,
} from '../services/api';

function ProjectPage() {
  const {
    projectId,
  } = useParams();

  const navigate =
    useNavigate();

  const [
    project,
    setProject,
  ] = useState(null);

  const [
    pages,
    setPages,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(true);

  const [
    isAddModalOpen,
    setIsAddModalOpen,
  ] = useState(false);

  const [
    editingPage,
    setEditingPage,
  ] = useState(null);
  const pagesSectionRef = useRef(null);
  const sitemapSectionRef = useRef(null);

  // =========================
  // LOAD PROJECT
  // =========================

  const fetchProjectData =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const projectsRes =
            await getProjects();

          const foundProject =
            projectsRes.data.find(
              (project) =>
                project.id ===
                Number(
                  projectId
                )
            );

          setProject(
            foundProject
          );

          const pagesRes =
            await getPages(
              projectId
            );

          setPages(
            pagesRes.data || []
          );
        } catch (error) {
          console.error(
            'Ошибка загрузки данных:',
            error
          );
        } finally {
          setLoading(false);
        }
      },
      [projectId]
    );

  useEffect(() => {
    fetchProjectData();
  }, [
    fetchProjectData,
  ]);

  // =========================
  // PAGE TREE
  // =========================

  const buildPageTree =
    (pageList) => {
      const pageMap =
        {};

      pageList.forEach(
        (page) => {
          pageMap[
            page.id
          ] = {
            ...page,
            children: [],
          };
        }
      );

      const tree = [];

      pageList.forEach(
        (page) => {
          if (
            page.parent_page_id
          ) {
            if (
              pageMap[
                page.parent_page_id
              ]
            ) {
              pageMap[
                page.parent_page_id
              ].children.push(
                pageMap[
                  page.id
                ]
              );
            }
          } else {
            tree.push(
              pageMap[
                page.id
              ]
            );
          }
        }
      );

      return tree;
    };

  // =========================
  // RENDER SITEMAP
  // =========================

  const renderSitemap =
    (
      pageList,
      level = 0
    ) => {
      const sortedPages =
        [
          ...pageList,
        ].sort(
          (
            a,
            b
          ) => {
            if (
              a.sort_order !==
                undefined &&
              b.sort_order !==
                undefined
            ) {
              return (
                a.sort_order -
                b.sort_order
              );
            }

            return a.title.localeCompare(
              b.title
            );
          }
        );
        const scrollToSection = (ref) => {
          if (ref.current) {
            ref.current.scrollIntoView({ 
              behavior: 'smooth', // Плавная прокрутка
              block: 'start'      // Прокрутить к началу элемента
            });
          }
        };

      return sortedPages.map(
        (
          page
        ) => {
          const hasChildren =
            page.children &&
            page.children
              .length > 0;

          const isRoot =
            level === 0;

          return (
            <div
              key={
                page.id
              }
            >
              <div
                className="py-1 flex items-center"
                style={{
                  paddingLeft: `${
                    level *
                    20
                  }px`,
                  color:
                    colors.primary,
                }}
              >
                {!isRoot && (
                  <span
                    style={{
                      marginRight:
                        '8px',
                    }}
                  >
                    •
                  </span>
                )}

                <span
                  style={{
                    fontSize:
                      isRoot
                        ? '20px'
                        : '18px',

                    fontWeight:
                      isRoot
                        ? '600'
                        : '400',

                    color:
                      colors.primary,
                  }}
                >
                  {
                    page.title
                  }
                </span>
              </div>

              {hasChildren && (
                <div>
                  {renderSitemap(
                    page.children,
                    level + 1
                  )}
                </div>
              )}
            </div>
          );
        }
      );
    };

  // =========================
  // OPEN CREATE MODAL
  // =========================

  const handleOpenCreate =
    () => {
      setEditingPage(
        null
      );

      setIsAddModalOpen(
        true
      );
    };

  // =========================
  // OPEN EDIT MODAL
  // =========================

  const handleEditPage =
    (
      page
    ) => {
      setEditingPage(
        page
      );

      setIsAddModalOpen(
        true
      );
    };

  // =========================
  // CLOSE MODAL
  // =========================

  const handleModalClose =
    async (
      shouldRefresh = false
    ) => {
      setIsAddModalOpen(
        false
      );

      setEditingPage(
        null
      );

      if (
        shouldRefresh
      ) {
        await fetchProjectData();
      }
    };

  // =========================
  // DELETE PAGE
  // =========================

  const handleDeletePage =
    async (
      pageId,
      event
    ) => {
      event.stopPropagation();

      const confirmed =
        window.confirm(
          'Вы уверены, что хотите удалить эту страницу?'
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        await deletePage(
          pageId
        );

        await fetchProjectData();
      } catch (error) {
        console.error(
          'Ошибка удаления страницы:',
          error
        );

        alert(
          'Не удалось удалить страницу'
        );
      }
    };

  // =========================
  // SIDEBAR
  // =========================

  const toggleSidebar =
    () => {
      setIsSidebarOpen(
        (prev) =>
          !prev
      );
    };

  // =========================
  // LOADING
  // =========================

  if (
    loading
  ) {
    return (
      <div className="h-screen flex items-center justify-center">
        Загрузка...
      </div>
    );
  }

  const pageTree =
    buildPageTree(
      pages
    );

  // =========================
  // RENDER
  // =========================

  return (
    <div className="min-h-screen p-3">
      <div
        className="rounded-2xl overflow-hidden border min-h-[95vh] relative"
        style={{
          borderColor:
            colors.lightGray,
        }}
      >

        {/* ========================= */}
        {/* SIDEBAR */}
        {/* ========================= */}

        <aside
          className={`fixed left-3 top-3 h-[calc(100vh-1.5rem)] z-10 transition-all duration-300 overflow-hidden ${
            isSidebarOpen
              ? 'w-[320px]'
              : 'w-0'
          } border rounded-2xl`}
          style={{
            borderColor:
              colors.lightGray,

            backgroundColor:
              colors.blue,
          }}
        >
          <div className="w-[320px] h-full flex flex-col">

            <div className="px-5 pt-5 flex items-center gap-4">

              <button
                onClick={
                  toggleSidebar
                }
              >
                <Menu
                  size={28}
                  className="text-black"
                />
              </button>

              <button
                onClick={() =>
                  navigate(
                    '/'
                  )
                }
              >
                <Undo2
                  size={28}
                  className="text-black"
                />
              </button>

            </div>

            <div
              className="mt-8 px-4 text-xl"
              style={{
                color:
                  colors.primary,
              }}
            >
              <div className="font-semibold mb-2">
                Структура сайта
              </div>

              <ul className="space-y-2 text-xl">
                <li 
                  className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => pagesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  <span>•</span>
                  <span>Страницы</span>
                </li>

                <li 
                  className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => sitemapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  <span>•</span>
                  <span>Карта</span>
                </li>

                <li className="flex items-center gap-2 opacity-50">
                  <span>•</span>
                  <span>События</span>
                </li>

                <li className="flex items-center gap-2 opacity-50">
                  <span>•</span>
                  <span>Чеклисты</span>
                </li>
              </ul>

              <div className="mt-5 font-semibold text-xl">
                Результат
              </div>

              <ul className="mt-2">
                <li className="flex items-center gap-2 text-xl">
                  <span>
                    •
                  </span>
                  <span>
                    Генерация PDF
                  </span>
                </li>
              </ul>
            </div>

          </div>
        </aside>

        {!isSidebarOpen && (
          <div className="fixed left-3 top-3 z-10 flex items-center gap-2">

            <button
              onClick={
                toggleSidebar
              }
              className="p-2 rounded-lg"
            >
              <Menu
                size={28}
                className="text-black"
              />
            </button>

            <button
              onClick={() =>
                navigate(
                  '/'
                )
              }
              className="rounded-lg"
            >
              <Undo2
                size={28}
                className="text-black"
              />
            </button>

          </div>
        )}

        {/* ========================= */}
        {/* HEADER */}
        {/* ========================= */}

        <div
          className="h-[70px] flex items-center justify-center px-10 border-b w-full"
          style={{
            borderBottomColor:
              colors.lightGray,

            backgroundColor:
              colors.background,
          }}
        >
          <h1
            className="text-2xl font-semibold"
            style={{
              color:
                colors.primary,
            }}
          >
            {
              project?.name
            }
          </h1>
        </div>

        {/* ========================= */}
        {/* MAIN */}
        {/* ========================= */}

        <main
          className={`flex-1 flex flex-col transition-all duration-300 ${
            isSidebarOpen
              ? 'ml-[340px]'
              : 'ml-[70px]'
          }`}
        >
          <div className="mt-10">

          {/* TITLE */}
            <div 
              ref={pagesSectionRef}
              className="scroll-mt-24 w-full max-w-[720px] mx-auto mb-7 grid grid-cols-3 items-center"
            >
              <div />
              <div className="flex justify-center">
                <h2 className="text-2xl font-semibold text-black">
                  Страницы сайта
                </h2>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={
                    handleOpenCreate
                  }
                  className="text-white font-semibold text-lg px-4 py-1.5 rounded-xl"
                  style={{
                    backgroundColor:
                      colors.primary,
                  }}
                >
                  + Добавить страницу
                </button>
              </div>

            </div>

            {/* ========================= */}
            {/* TABLE */}
            {/* ========================= */}

            <div className="w-full max-w-[720px] mx-auto">

              <table
                className="w-full border border-collapse bg-white"
                style={{
                  borderColor:
                    colors.lightGray,
                }}
              >

                <thead>
                  <tr
                    style={{
                      backgroundColor:
                        '#eef2f6',
                    }}
                  >

                    <th
                      className="border px-4 py-3 text-xl font-semibold text-left w-[240px]"
                      style={{
                        borderColor:
                          colors.lightGray,
                        color:
                          colors.primary,
                      }}
                    >
                      Название
                    </th>

                    <th
                      className="border px-4 py-3 text-xl font-semibold text-left"
                      style={{
                        borderColor:
                          colors.lightGray,
                        color:
                          colors.primary,
                      }}
                    >
                      Ссылки
                    </th>

                    <th
                      className="border w-[44px]"
                      style={{
                        borderColor:
                          colors.lightGray,
                      }}
                    />

                    <th
                      className="border w-[44px]"
                      style={{
                        borderColor:
                          colors.lightGray,
                      }}
                    />

                  </tr>
                </thead>

                <tbody>

                  {pages.map(
                    (
                      page
                    ) => (
                      <tr
                        key={
                          page.id
                        }
                      >

                        <td
                          className="border px-4 py-3 text-lg"
                          style={{
                            borderColor:
                              colors.lightGray,

                            color:
                              colors.primary,
                          }}
                        >
                          <button
                            onClick={() =>
                              navigate(
                                `/project/${projectId}/page/${page.id}`
                              )
                            }
                            className="hover:text-blue-600 hover:underline transition-colors cursor-pointer text-left w-full"
                            style={{
                              color:
                                colors.primary,
                            }}
                          >
                            {
                              page.title
                            }
                          </button>
                        </td>

                        <td
                          className="border px-4 py-3 text-lg"
                          style={{
                            borderColor:
                              colors.lightGray,

                            color:
                              colors.primary,
                          }}
                        >
                          {page.links?.map(
                            (
                              link,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                              >
                                {
                                  link.url
                                }
                              </div>
                            )
                          )}
                        </td>

                        <td
                          className="border text-center"
                          style={{
                            borderColor:
                              colors.lightGray,
                          }}
                        >
                          <button
                            onClick={() =>
                              handleEditPage(
                                page
                              )
                            }
                            className="hover:text-blue-600 transition"
                          >
                            <Pencil
                              size={18}
                            />
                          </button>
                        </td>

                        <td
                          className="border text-center"
                          style={{
                            borderColor:
                              colors.lightGray,
                          }}
                        >
                          <button
                            className="hover:text-red-500 transition"
                            onClick={(
                              event
                            ) =>
                              handleDeletePage(
                                page.id,
                                event
                              )
                            }
                          >
                            <Trash2
                              size={18}
                            />
                          </button>
                        </td>

                      </tr>
                    )
                  )}

                  {pages.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan="4"
                        className="text-center py-6"
                        style={{
                          color:
                            colors.secondaryText,
                        }}
                      >
                        Нет добавленных страниц
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </div>
            <div 
              ref={sitemapSectionRef}
              className="scroll-mt-24 mt-10 w-full max-w-[720px] mx-auto"
            >
              <h2 className="text-2xl font-semibold mb-6 text-center text-black">
                Карта сайта
              </h2>
              <div
                className="border rounded-lg p-6"
                style={{
                  borderColor:
                    colors.lightGray,
                }}
              >

                {pages.length ===
                0 ? (
                  <div
                    className="text-center py-8"
                    style={{
                      color:
                        colors.secondaryText,
                    }}
                  >
                    Нет страниц для отображения карты сайта
                  </div>
                ) : (
                  <div>
                    {renderSitemap(
                      pageTree
                    )}
                  </div>
                )}

              </div>

            </div>

          </div>
        </main>

      </div>

      {/* ========================= */}
      {/* MODAL */}
      {/* ========================= */}

      <AddPageModal
        isOpen={
          isAddModalOpen
        }
        onClose={
          handleModalClose
        }
        projectId={
          projectId
        }
        onSavePage={
          createPage
        }
        onUpdatePage={
          updatePage
        }
        editingPage={
          editingPage
        }
      />

    </div>
  );
}

export default ProjectPage;