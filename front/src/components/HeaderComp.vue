<template>
    <div class="header-container">
        <h1 class="title">Midi Demo Page</h1>
        <p class="subtitle">by eri24816</p>
        <!-- <div class="links">
            <a href="https://github.com/your-repo" target="_blank" class="link">View on GitHub</a>
        </div> -->
    </div>
</template>

<style scoped>
.header-container {
    text-align: center;
    padding: 30px 20px;
    background: linear-gradient(120deg, #1a365d, #967a64);
    color: white;
}

.title {
    font-size: 48px;
    font-weight: 600;
    margin: 0 0 16px 0;
    color: rgba(255, 255, 255, 0.95);
}

.subtitle {
    font-size: 18px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 24px 0;
}

.links {
    display: flex;
    justify-content: center;
    gap: 16px;
}

.link {
    color: white;
    text-decoration: none;
    padding: 8px 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    font-size: 14px;
    transition: all 0.2s ease;
}

.link:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
}
</style>


