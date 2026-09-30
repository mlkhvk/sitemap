import React, { useState } from 'react';
import colors from '../colors';

// Управляет модальным окном создания проекта
function CreateProjectModal({ isOpen, onClose, onCreate }) {
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Проверяет название и создаёт новый проект
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setError('Введите название проекта');
      return;
    }

    setError('');
    onCreate(projectName);
    setProjectName('');
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-xl text-center font-medium mb-5"
          style={{ color: colors.primary }}
        >
          Введите название нового проекта:
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <input
              type="text"
              value={projectName}
              onChange={(e) =>
                setProjectName(e.target.value)
              }
              placeholder="Пример: магазин одежды"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                borderColor: colors.lightGray,
              }}
              onFocus={(e) =>
                e.target.style.borderColor =
                  colors.primary
              }
              onBlur={(e) =>
                e.target.style.borderColor =
                  colors.lightGray
              }
              autoFocus
            />

            {error && (
              <div className="text-red-500 text-sm mt-2">
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{
                color: colors.secondaryText,
              }}
              onMouseLeave={(e) =>
                e.target.style.backgroundColor =
                  'transparent'
              }
            >
              Отмена
            </button>

            <button
              type="submit"
              className="px-4 py-2 text-white rounded-lg transition-colors"
              style={{
                backgroundColor: colors.lightBlue,
              }}
              onMouseEnter={(e) =>
                e.target.style.backgroundColor =
                  colors.primary
              }
              onMouseLeave={(e) =>
                e.target.style.backgroundColor =
                  colors.lightBlue
              }
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProjectModal;