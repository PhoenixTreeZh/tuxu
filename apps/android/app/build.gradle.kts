plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose") }

val releaseKey = System.getenv("TUXU_KEYSTORE")?.let { file(it) }
    ?: rootProject.file("../../_rea_temp/release-android/signing/tuxu-release.p12")
val releasePassword = System.getenv("TUXU_KEY_PASSWORD")
val hasReleaseKey = releaseKey.isFile && !releasePassword.isNullOrBlank()

android {
    namespace = "cn.tuxu.drawing"
    compileSdk = 35
    defaultConfig {
        applicationId = "cn.tuxu.drawing"
        minSdk = 28
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    signingConfigs {
        if (hasReleaseKey) create("localRelease") {
            storeFile = releaseKey
            storePassword = releasePassword
            keyAlias = System.getenv("TUXU_KEY_ALIAS") ?: "tuxu"
            keyPassword = System.getenv("TUXU_KEY_ALIAS_PASSWORD") ?: releasePassword
        }
    }
    buildTypes {
        release { isMinifyEnabled = false; if (hasReleaseKey) signingConfig = signingConfigs.getByName("localRelease") }
    }
    buildFeatures { compose = true; buildConfig = true }
    if (!file("src/main/assets/content/index/catalog.json").isFile) {
        sourceSets.getByName("main").assets.srcDir(rootProject.file("../../samples/demo-assets"))
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    androidResources { noCompress += listOf("mp4", "webm", "gif") }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.05.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("top.yukonga.miuix.kmp:miuix:0.4.5")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.caverock:androidsvg-aar:1.4")
    implementation("androidx.media3:media3-exoplayer:1.6.1")
    implementation("androidx.media3:media3-ui:1.6.1")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4:1.8.1")
    debugImplementation("androidx.compose.ui:ui-test-manifest:1.8.1")
}
