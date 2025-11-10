plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}


android {
    namespace = "com.ou3a.joura"
    compileSdk = 35


    defaultConfig {
        applicationId = "com.ou3a.joura"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"


// For WorkManager unique names
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }


    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }


    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }


    packaging {
        resources.excludes += setOf("META-INF/DEPENDENCIES")
    }
}


dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")


// Location Services
    implementation("com.google.android.gms:play-services-location:21.3.0")


// JSON streaming via Gson
    implementation("com.google.code.gson:gson:2.11.0")


// WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.1")


// Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}