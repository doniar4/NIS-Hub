import type { Locale } from './i18n';
const copy = {
  ru: { choose: 'Выбрать фото', noFile: 'Фото не выбрано', crop: 'Кадр аватара', hint: 'Перетащите фото или настройте положение ползунками.', zoom: 'Масштаб', x: 'По горизонтали', y: 'По вертикали', reset: 'Сбросить кадр', cancel: 'Отмена', invalid: 'Не удалось открыть изображение. Выберите JPG, PNG или другой формат, поддерживаемый браузером, до 20 МБ и 40 млн пикселей.', loading: 'Открываем изображение…' },
  kk: { choose: 'Фото таңдау', noFile: 'Фото таңдалмаған', crop: 'Аватар кадры', hint: 'Суретті сүйреңіз немесе жүгірткілермен реттеңіз.', zoom: 'Масштаб', x: 'Көлденең', y: 'Тігінен', reset: 'Кадрды қалпына келтіру', cancel: 'Бас тарту', invalid: 'Суретті ашу мүмкін болмады. Браузер қолдайтын JPG, PNG немесе басқа форматты таңдаңыз: 20 МБ және 40 млн пиксельге дейін.', loading: 'Сурет ашылуда…' },
  en: { choose: 'Choose photo', noFile: 'No photo selected', crop: 'Avatar crop', hint: 'Drag the photo or adjust its position with the sliders.', zoom: 'Zoom', x: 'Horizontal position', y: 'Vertical position', reset: 'Reset crop', cancel: 'Cancel', invalid: 'Could not open this image. Choose JPG, PNG or another browser-supported format up to 20 MiB and 40 million pixels.', loading: 'Opening image…' },
};
export function avatarEditorCopy(locale: Locale) { return copy[locale]; }
