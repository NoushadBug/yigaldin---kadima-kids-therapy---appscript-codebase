document.addEventListener("DOMContentLoaded", function () {
  checkLogin();
  // Update the Alpine.js state
  syncAlpineData();
});

function toggleBtnLoader(selector, turnOff = false) {
  const Btn = document.querySelector(selector);
  const BtnSvg = document.querySelector(selector + " svg").parentElement;
  if (!turnOff) {
    Btn.classList.add("disabled");
    BtnSvg.classList.remove("hidden");
  } else {
    Btn.classList.remove("disabled");
    BtnSvg.classList.add("hidden");
  }
}

async function login() {
  Alpine.store("appStore", JSON.parse(JSON.stringify(initialData)));
  toggleBtnLoader("#login-btn");

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();

  if (!email || !password) {
    toggleBtnLoader("#login-btn", true);
    toastr.warning("You must input both email and password!");
    return;
  }

  try {
    const user = await makeApiGetRequest("login", { email, password });

    emailEl.value = "";
    passwordEl.value = "";
    toggleBtnLoader("#login-btn", true);

    if (user && user.id) {
      document.querySelector(".userName").innerText = user.name;
      document.querySelector("main").classList.remove("main-center");

      Alpine.store("appStore").isAdmin = user.id === "admin";

      setLocalStorage("loggedInUser", user, 5);

      // Replace unauthorizedComponent with authorizedComponentxx
      document.querySelectorAll(".unauthorizedComponent").forEach((element) => {
        element.classList.replace("unauthorizedComponent", "authorizedComponentxx");
      });

      sessionForm().initData();
      syncAlpineData(); // Ensure Alpine.js state is updated
    } else {
      toastr.error("Invalid login");
    }
  } catch (error) {
    toggleBtnLoader("#login-btn", true);
    toastr.error(`Login failed: ${error.message}`);
  }
}


function formatDateForDataTable(dateString) {
  try {
    // Split the input date string into day, month, and year
    const parts = dateString.split("/");
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];

    // Return the formatted date string in YYYYMMDD format
    return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}` || "";
  } catch (e) {
    return "";
  }
}



function changeView(viewName) {
  Alpine.store("appStore").promotionLoaded = false;
  Alpine.store("appStore").promotionCreateView = false;
  Alpine.store("appStore").promotionRequestView = false;
  Alpine.store("appStore")[viewName] = true;
}


function logout() {
  // Remove the user data from localStorage
  localStorage.removeItem("loggedInUser");
  document.querySelector("main").classList.add("main-center");
  syncAlpineData();
}

function syncAlpineData() {
  Alpine.store("appStore").isULoggedIn =
    localStorage.getItem("loggedInUser") !== null;
  Alpine.store("appStore").isUNotLoggedIn =
    localStorage.getItem("loggedInUser") === null;
}

function checkLogin() {
  const user = getLocalStorage("loggedInUser");
  if (user) {
    document.querySelector(".userName").innerText = user.name;
    document.querySelector("main").classList.remove("main-center");
  } else {
    document.querySelector("main").classList.add("main-center");
  }
}


function setLocalStorage(key, value, hours) {
  const now = new Date().getTime();
  const expirationTime = now + hours * 60 * 60 * 1000;
  const data = {
    value: value,
    expiresAt: expirationTime,
  };
  // Alpine.store("appStore")["loggedUser"] = JSON.stringify(data)
  localStorage.setItem(key, JSON.stringify(data));
}

function getLocalStorage(key) {
  const data = JSON.parse(localStorage.getItem(key));
  if (!data) {
    return null;
  }
  const now = new Date().getTime();
  if (now > data.expiresAt) {
    localStorage.removeItem(key);
    return null;
  }
  return data.value;
}

function deleteLocalStorage(key) {
  localStorage.removeItem(key);
}

// Toastr configuration
toastr.options = {
  closeButton: true,
  debug: false,
  newestOnTop: false,
  progressBar: true,
  positionClass: "toast-top-right",
  preventDuplicates: false,
  onclick: null,
  showDuration: "300",
  hideDuration: "1000",
  timeOut: "5000",
  extendedTimeOut: "1000",
  showEasing: "swing",
  hideEasing: "linear",
  showMethod: "fadeIn",
  hideMethod: "fadeOut",
};

function showSuccess(head, msg) {
  toastr.success(msg, head);
}

function showError(head, msg) {
  toastr.error(msg, head);
}

function showInfo(head, msg) {
  toastr.info(msg, head);
}

function showWarning(head, msg) {
  toastr.warning(msg, head);
}
