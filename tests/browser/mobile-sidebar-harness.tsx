import {createRoot} from "react-dom/client";
import {AppFrame} from "../../src/components/app-frame";
import {LocaleProvider} from "../../src/components/locale-provider";

function Harness() {
  return <LocaleProvider locale="ru">
    <AppFrame
      preferences={<div className="mobile-fixture-preferences"><button type="button">RU</button><button type="button">Тема</button></div>}
      account={<button type="button">Войти</button>}
      avatar={null}
    >
      <section style={{minHeight:"160vh"}}>
        <h1>Мобильная навигация</h1>
        <p>Изолированный интерфейс для проверки панели.</p>
      </section>
    </AppFrame>
  </LocaleProvider>;
}

createRoot(document.getElementById("root")!).render(<Harness/>);
