<template>
    <div class="left-bar">
        <div class="left-bar-content">
            <div class="left-bar-section">
                <h1>Assets</h1>
                <button>+</button>
            </div>
            <div class="left-bar-section">
                <h1>Suggestions</h1>
                <button>+</button>
            </div>
        </div>

        <FooterComp class="footer"/>
    </div>
</template>

<script setup lang="ts">
import FooterComp from './FooterComp.vue'
</script>

<style scoped>
h1 {
    font-size: 16px;
    margin: 0;
    font-weight: 400;
}

.left-bar {
    background-color: #0B0B0B;
    padding:  10px 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}


.left-bar-section {
    padding: 10px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
</style>