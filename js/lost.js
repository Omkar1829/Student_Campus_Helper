
const allBtn = document.getElementById("allBtn");
const lostBtn = document.getElementById("lostBtn");
const foundBtn = document.getElementById("foundBtn");

allBtn.addEventListener("click", () => {
    document.querySelectorAll(".card").forEach(card => {
        card.classList.remove("hidden");
    });
});

lostBtn.addEventListener("click", () => {
    document.querySelectorAll(".card").forEach(card => {
        card.classList.toggle("hidden", !card.classList.contains("lost"));
    });
});

foundBtn.addEventListener("click", () => {
    document.querySelectorAll(".card").forEach(card => {
        card.classList.toggle("hidden", !card.classList.contains("found"));
    });
});

const openBtn = document.getElementById("openModal");
const closeBtn = document.getElementById("closeModal");
const modal = document.getElementById("modal");

openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
closeBtn.addEventListener("click", () => modal.classList.add("hidden"));

window.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
});

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("keyup", () => {
    const value = searchInput.value.toLowerCase();

    document.querySelectorAll(".card").forEach(card => {
        const text = card.innerText.toLowerCase();
        card.classList.toggle("hidden", !text.includes(value));
    });
});

const submitBtn = document.getElementById("submitBtn");
const cardContainer = document.getElementById("cardContainer");

window.addEventListener("DOMContentLoaded", () => {

    const savedCards = JSON.parse(localStorage.getItem("cards")) || [];

    savedCards.forEach(data => {
        createCard(data);
    });

    updateStats(); 
});

function createCard(data) {

    const newCard = document.createElement("div");

    newCard.className = "card lost bg-red-50 rounded-lg border border-black h-[360px] p-4 flex flex-col gap-2";

    newCard.innerHTML = `
        <div class="h-36 w-full overflow-hidden rounded mb-2 bg-gray-100 flex items-center justify-center">
            <img src="${data.image}" class="max-h-full max-w-full object-contain">
        </div>

        <div class="flex justify-between items-center">
            <h3 class="font-bold text-lg">${data.name}</h3>
            <button class="bg-red-300 text-xs px-2 py-1 rounded">Lost</button>
        </div>

        <p class="text-sm">${data.desc}</p>
        <p class="text-sm">${data.loc}</p>
        <p class="text-sm">${data.date}</p>
     

        <button class="claimBtn bg-blue-200 text-xs px-2 py-1 rounded self-start">Search</button>
    `;

    newCard.querySelector(".claimBtn").addEventListener("click", () => {
        newCard.remove();

        let cards = JSON.parse(localStorage.getItem("cards")) || [];
        cards = cards.filter(item => item.name !== data.name);
        localStorage.setItem("cards", JSON.stringify(cards));

        updateStats(); 
    });

    cardContainer.prepend(newCard);
}

submitBtn.addEventListener("click", () => {

    const name = document.getElementById("itemName").value;
    const desc = document.getElementById("description").value;
    const loc = document.getElementById("location").value;
    const date = document.getElementById("date").value;
    const imageFile = document.getElementById("imageInput").files[0];

    if (!name || !desc || !loc || !date) {
        alert("Please fill all fields");
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {

        const cardData = {
            name,
            desc,
            loc,
            date,
            image: e.target.result
        };

      
        let cards = JSON.parse(localStorage.getItem("cards")) || [];
        cards.push(cardData);
        localStorage.setItem("cards", JSON.stringify(cards));

        createCard(cardData);
        updateStats(); 
    };

    if (imageFile) {
        reader.readAsDataURL(imageFile);
    } else {
        reader.onload({
            target: {
                result: "https://via.placeholder.com/300"
            }
        });
    }

    document.getElementById("itemName").value = "";
    document.getElementById("description").value = "";
    document.getElementById("location").value = "";
    document.getElementById("date").value = "";
    document.getElementById("imageInput").value = "";

    modal.classList.add("hidden");
});


function updateStats() {

    const allCards = document.querySelectorAll(".card");
    const lostCards = document.querySelectorAll(".card.lost");
    const foundCards = document.querySelectorAll(".card.found");

    const total = allCards.length;
    const lost = lostCards.length;
    const found = foundCards.length;

    const recovery = total === 0 ? 0 : Math.round((found / total) * 100);

    document.getElementById("totalCount").innerText = total;
    document.getElementById("lostCount").innerText = lost;
    document.getElementById("foundCount").innerText = found;
    document.getElementById("recoveryRate").innerText = recovery + "%";
}