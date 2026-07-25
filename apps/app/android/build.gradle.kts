allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Backfill a Gradle `namespace` for legacy plugins that only declare a `package`
// in their AndroidManifest (e.g. image_compression_flutter 1.0.4). AGP 8+ requires
// an explicit namespace, so we derive it from the manifest package after the
// plugin's build script is evaluated. Registered BEFORE evaluationDependsOn(":app")
// below, which would otherwise evaluate some subprojects before this hook attaches.
subprojects {
    afterEvaluate {
        val android = extensions.findByName("android") ?: return@afterEvaluate

        // Backfill the namespace from the manifest package if the plugin didn't
        // declare one (image_compression_flutter 1.0.4) — AGP 8+ requires it.
        val getNamespace = android.javaClass.methods.firstOrNull { it.name == "getNamespace" }
        val setNamespace = android.javaClass.methods.firstOrNull { it.name == "setNamespace" }
        if (getNamespace != null && setNamespace != null &&
            getNamespace.invoke(android) == null
        ) {
            val manifest = file("src/main/AndroidManifest.xml")
            if (manifest.exists()) {
                val pkg = Regex("package=\"(.+?)\"")
                    .find(manifest.readText())?.groupValues?.get(1)
                if (pkg != null) {
                    setNamespace.invoke(android, pkg)
                }
            }
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
