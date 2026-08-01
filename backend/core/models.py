from django.db import models

class Setting(models.Model):
    key = models.CharField(max_length=255, primary_key=True)
    value = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'settings'

    def __str__(self):
        return f"{self.key}: {self.value}"

class Applicant(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=50)
    gpa = models.FloatField()
    stream = models.CharField(max_length=100)
    department = models.CharField(max_length=100)
    status = models.CharField(max_length=50, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'applicants'

    def __str__(self):
        return f"{self.name} ({self.department}) - {self.status}"

class User(models.Model):
    username = models.CharField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50, default='admin')

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.username} ({self.full_name})"

class Department(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=50) # medical or tech
    duration = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    icon = models.CharField(max_length=100)
    image_url = models.TextField(blank=True, default='')
    careers = models.TextField(blank=True, default='')
    courses = models.JSONField(default=list)

    class Meta:
        db_table = 'departments'

    def __str__(self):
        return f"{self.name} ({self.category})"

def seed_db():
    import bcrypt
    
    # Seed default homepage settings if not already present
    default_settings = {
        'top_phone': '+967 777 777 777',
        'top_email': 'info@alsadara.edu.ye',
        'top_address': 'صنعاء، اليمن',
        'hero_tag': 'القبول والتسجيل مفتوح للعام الدراسي الجديد 2026/2027',
        'hero_title': 'كلية الصدارة للعلوم الطبية والتقنية',
        'hero_subtitle': 'صدارة التعليم لمستقبل واعد',
        'hero_desc': 'نحن في كلية الصدارة نسعى لتوفير بيئة تعليمية أكاديمية متطورة تدمج بين الجانب النظري المبتكر والتطبيق العملي المكثف في أحدث المختبرات والمنشآت لتخريج نخبة من الكفاءات الطبية والتقنية.',
        'countdown_end': '2026-09-30T23:59:59',
        'stat_students': '5000',
        'stat_depts': '11',
        'stat_employment': '98',
        'stat_labs': '16',
        'social_facebook': '#',
        'social_twitter': '#',
        'social_linkedin': '#',
        'social_youtube': '#',
        'about_us_p1': 'كلية الصدارة للعلوم الطبية والتقنية هي صرح تعليمي رائد مرخص ومعتمد من وزارة التعليم الفني والتدريب المهني. تأسست الكلية لتلبي الحاجة المتزايدة للتعليم التطبيقي عالي الجودة والتدريب الاحترافي، لتواكب التطور التكنولوجي والطبي السريع عالمياً.',
        'about_us_p2': 'نلتزم بتخريج كوادر تمتلك المعرفة النظرية المتطورة والمهارة العملية الدقيقة التي تتطلبها مؤسسات الرعاية الصحية والقطاعات التكنولوجية والإدارية محلياً ودولياً.',
        'about_image': '/media/hero.png',
        'about_vision': 'أن نكون الوجهة الأكاديمية المفضلة إقليمياً لإعداد قادة الرعاية الصحية وخبراء التكنولوجيا، وأن نقود التميز والريادة في قطاع التعليم المهني التطبيقي.',
        'about_mission': 'تقديم برامج تعليمية مميزة تجمع بين المناهج النظرية المبتكرة والتدريب العملي المكثف في بيئة تدعم الإبداع والتطور المستمر لبناء كفاءات تلبي الاحتياجات التنافسية لسوق العمل.',
        'about_goals': 'تطور مهارات الطلاب الذاتية والمهنية، بناء شراكات وثيقة مع قطاعات الأعمال والمستشفيات للتوظيف، وتجهيز معامل تفاعلية تمثل أحدث ما توصلت إليه التقنيات.',
        'dean_name': 'أ.د. فيصل عائض',
        'dean_title': 'عميد الكلية',
        'dean_avatar': '/media/file.png',
        'dean_message_quote': 'أبنائي وبناتي الطلبة، يسعدني أن أرحب بكم في رحاب كلية الصدارة للعلوم الطبية والتقنية. إن قراركم بالالتحاق بالكلية هو خطوة أولى نحو مستقبل مهني مشرق ومضمون. نحن هنا لسنا فقط لنعلمكم، بل لنلهمكم ونمكنكم من اكتساب المهارات والخبرات التي تجعلكم فخورين بأنفسكم، ومطلبًا أساسيًا لكافة مشافي ومؤسسات وشركات الوطن.',
        'dean_message_p2': 'نسخر كل طاقاتنا لتوفير معامل مجهزة وتدريب إكلينيكي ممتاز في المستشفيات الحكومية لضمان ريادتكم وصدارتكم دائماً.'
    }
    
    for key, val in default_settings.items():
        Setting.objects.get_or_create(key=key, defaults={'value': val})

    # Seed default applicants to match front-end demo data
    default_applicants = [
        ('خالد عبد الوهاب المرادي', '+967 771 234 567', 89.5, 'scientific', 'صيدلة'),
        ('هدى أحمد الشرفي', '+967 775 987 654', 94.2, 'scientific', 'تقنية معلومات (IT)'),
        ('علي يحيى الذماري', '+967 773 456 789', 81.0, 'scientific', 'فني أسنان'),
        ('بلقيس صالح المطري', '+967 770 111 222', 88.4, 'scientific', 'قبالة وتوليد'),
        ('مازن محمد الخولاني', '+967 777 999 888', 85.7, 'scientific', 'مساعد طبيب')
    ]
    
    if Applicant.objects.count() == 0:
        for name, phone, gpa, stream, dept in default_applicants:
            Applicant.objects.create(
                name=name,
                phone=phone,
                gpa=gpa,
                stream=stream,
                department=dept,
                status='pending'
            )
            
    # Seed default admin user (username: admin, password: admin_sadara_2026)
    if not User.objects.filter(username='admin').exists():
        hashed = bcrypt.hashpw('admin_sadara_2026'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        User.objects.create(
            username='admin',
            password_hash=hashed,
            full_name='أ.د. فيصل عائض',
            role='superuser'
        )

    # Seed default departments
    if Department.objects.count() == 0:
        default_depts = [
            {
                'name': 'فني أسنان',
                'code': 'dental-tech',
                'category': 'medical',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'يقوم هذا التخصص بتجهيز وتدريب الطلاب على تصميم وتصنيع كافة التعويضات السنية (أطقم الأسنان، التيجان، الجسور، والأجهزة التقويمية) باستخدام الأنظمة اليدوية المهارية والأنظمة الرقمية المعتمدة على تقنية CAD/CAM.',
                'icon': 'fa-tooth',
                'image_url': 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&q=80&w=400',
                'careers': 'معامل تصنيع الأسنان الخاصة، المشافي التخصصية للأسنان، شركات تسويق مستلزمات الأسنان، إدارة مراكز تصنيع وتصميم الأسنان الرقمية.',
                'courses': [
                    {'code': 'DT-101', 'name': 'تشريح ووظائف الأسنان الرسمية', 'type': 'نظري + عملي معملي'},
                    {'code': 'DT-203', 'name': 'تصميم الأسنان الرقمي ثلاثي الأبعاد CAD/CAM', 'type': 'عملي تطبيقي مكثف'},
                    {'code': 'DT-205', 'name': 'صناعة أطقم وجسور الأسنان الخزفية والزركونية', 'type': 'تدريب إكلينيكي وتطبيقي'}
                ]
            },
            {
                'name': 'فني عمليات وتعقيم',
                'code': 'operations',
                'category': 'medical',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'تأهيل الفنيين ليكونوا جزءاً حيوياً من الفريق الجراحي، مع التدريب على تحضير غرف العمليات وتوفير بيئة جراحية معقمة وخالية من العدوى والتعامل مع الآلات الجراحية الحديثة.',
                'icon': 'fa-kit-medical',
                'image_url': 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400',
                'careers': 'غرف العمليات في المشافي الحكومية والخاصة، أقسام التعقيم المركزي (CSSD)، مراكز الجراحة النهارية، طواقم الإسعاف والطوارئ الجراحية.',
                'courses': [
                    {'code': 'OT-102', 'name': 'أساسيات وتقنيات التعقيم ومكافحة العدوى', 'type': 'نظري + عملي معملي'},
                    {'code': 'OT-204', 'name': 'الأجهزة والآلات الجراحية ومساعد الجراح', 'type': 'تطبيق مستشفيات'},
                    {'code': 'OT-206', 'name': 'رعاية المرضى في مرحلة ما قبل وما بعد الجراحة', 'type': 'تدريب سريري مكثف'}
                ]
            },
            {
                'name': 'مساعد طبيب',
                'code': 'physician-assistant',
                'category': 'medical',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'تقديم رعاية صحية وعلاجية أولية وتشخيص الحالات الشائعة وتقديم الإسعافات والمساعدة الفعالة للأطباء في المراكز الطبية والعيادات.',
                'icon': 'fa-user-doctor',
                'image_url': 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=400',
                'careers': 'المراكز الصحية الريفية والأولية، العيادات والمجمعات التخصصية، عيادات الإسعاف والطورائ، المنظمات الإنسانية والإغاثية الطبية.',
                'courses': [
                    {'code': 'PA-101', 'name': 'علم التشريح وعلم وظائف الأعضاء', 'type': 'نظري + عملي'},
                    {'code': 'PA-202', 'name': 'الفحص السريري والتشخيص الأولي للأمراض', 'type': 'تدريب مستشفى'},
                    {'code': 'PA-204', 'name': 'علم الأدوية الأساسي والوصفات الطبية المعتمدة', 'type': 'تطبيق سريري'}
                ]
            },
            {
                'name': 'تمريض عالي',
                'code': 'nursing',
                'category': 'medical',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'تأهيل ممرضين وممرضات على مستوى عالٍ من الكفاءة لتقديم الرعاية الطبية والسريرية والتعامل مع الحالات الطبية الطارئة والحرجة في العناية المركزة والمشافي.',
                'icon': 'fa-user-nurse',
                'image_url': 'https://images.unsplash.com/photo-1584515901387-a7a1a7f35360?auto=format&fit=crop&q=80&w=400',
                'careers': 'أقسام العناية المركزة والطوارئ بالمستشفيات، مراكز غسيل الكلى، مراكز الأورام، القطاع التعليمي الطبي، والمراكز الطبية العامة.',
                'courses': [
                    {'code': 'NS-101', 'name': 'أساسيات التمريض السريري والرعاية الصحية', 'type': 'معمل تمريض محاكاة'},
                    {'code': 'NS-203', 'name': 'تمريض الحالات الحرجة والعناية المركزة', 'type': 'سريري بالمستشفى'},
                    {'code': 'NS-205', 'name': 'تمريض الأطفال وصحة المجتمع', 'type': 'تدريب ميداني'}
                ]
            },
            {
                'name': 'صيدلة',
                'code': 'pharmacy',
                'category': 'medical',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'دراسة الأدوية وتركيباتها الكيميائية، والتدريب على تحضير الأدوية ووصفها وإرشاد المرضى للطرق الصحيحة للاستخدام وإدارة الصيدليات ومخازن الأدوية.',
                'icon': 'fa-capsules',
                'image_url': 'https://images.unsplash.com/photo-1577158200653-64da653062d3?auto=format&fit=crop&q=80&w=400',
                'careers': 'الصيدليات الخاصة وصيدليات المستشفيات، شركات صناعة الأدوية ومعامل التحضير، مندوب تسويق طبي لدى شركات الأدوية، مستودعات الأدوية.',
                'courses': [
                    {'code': 'PH-102', 'name': 'علم الأدوية الأساسي والسريري', 'type': 'نظري + عملي'},
                    {'code': 'PH-204', 'name': 'الصيدلانيات وتصنيع المستحضرات الطبية', 'type': 'زيارة وتطبيق مصانع'},
                    {'code': 'PH-206', 'name': 'الكيمياء الدوائية والتحليل الصيدلاني', 'type': 'عملي معملي'}
                ]
            },
            {
                'name': 'مختبرات',
                'code': 'laboratories',
                'category': 'medical',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'تدريب عملي متكامل لتأهيل فنيي مختبرات قادرين على إجراء أدق الفحوصات والتحاليل الطبية (الكيميائية، البكتيرية، والهرمونية) لتشخيص ومكافحة الأمراض.',
                'icon': 'fa-microscope',
                'image_url': 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=400',
                'careers': 'المختربرات التشخيصية الطبية الخاصة والمشتركة، مراكز بنك الدم والتحاليل الجينية، مختبرات الرقابة الدوائية والصناعات الغذائية.',
                'courses': [
                    {'code': 'LB-101', 'name': 'علم الدم وكيمياء الدم السريرية', 'type': 'معمل الكلية التفاعلي'},
                    {'code': 'LB-203', 'name': 'علم الأحياء الدقيقة والميكروبات الطبية', 'type': 'نظري + عملي'},
                    {'code': 'LB-205', 'name': 'التحاليل الطبية المتقدمة والتقنيات الهرمونية', 'type': 'تدريب ميداني بالمستشفيات'}
                ]
            },
            {
                'name': 'قبالة وتوليد',
                'code': 'midwifery',
                'category': 'medical',
                'duration': '3 سنوات (دبلوم عالي - إناث فقط)',
                'description': 'إعداد قابلات محترفات لتقديم رعاية صحية ونفسية شاملة ومرافقة الأمهات الحوامل ومتابعة نمو الجنين وإجراء عمليات التوليد الطبيعية وتوفير رعاية الطفل بعد الولادة.',
                'icon': 'fa-heart-pulse',
                'image_url': 'https://images.unsplash.com/photo-1505151828120-04874d82b6b0?auto=format&fit=crop&q=80&w=400',
                'careers': 'أقسام التوليد والنساء في المشافي والمراكز الصحية، عيادات الأمومة والطفولة، منظمات صحة وتأهيل المرأة، المراكز الطبية التخصصية.',
                'courses': [
                    {'code': 'MW-101', 'name': 'الرعاية الصحية للأمهات وصحة الجنين', 'type': 'نظري وعملي معملي'},
                    {'code': 'MW-202', 'name': 'إجراء عمليات التوليد الطبيعية والطارئة', 'type': 'تدريب غرف الولادة'},
                    {'code': 'MW-204', 'name': 'رعاية حديثي الولادة والأطفال الرضع', 'type': 'تطبيق سريري بالعيادة'}
                ]
            },
            {
                'name': 'إدارة أعمال وتجارة إلكترونية',
                'code': 'business',
                'category': 'tech',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'تأهيل قادة ورياديين قادرين على إدارة الشركات والمشاريع الريادية والمنصات والتجارة الإلكترونية والتسويق الرقمي بفعالية وفق الأنظمة السحابية الحديثة.',
                'icon': 'fa-house-laptop',
                'image_url': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400',
                'careers': 'إدارة المتاجر الإلكترونية والمنصات التجارية، شركات التسويق الرقمي، البنوك والمؤسسات المالية، إدارة المشاريع الناشئة والريادية.',
                'courses': [
                    {'code': 'BA-102', 'name': 'مبادئ إدارة الأعمال والقيادة التنظيمية', 'type': 'نظري وحالات دراسية'},
                    {'code': 'EC-204', 'name': 'التجارة الإلكترونية وتصميم المواقع التجارية', 'type': 'عملي برامجي'},
                    {'code': 'DM-206', 'name': 'التسويق الرقمي وإدارة الحملات الإعلانية', 'type': 'تطبيق على منصات حقيقية'}
                ]
            },
            {
                'name': 'محاسبة مالية',
                'code': 'accounting',
                'category': 'tech',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'تمكين الطلاب من إعداد النظم المحاسبية والميزانيات وإعداد الدفاتر المالية والتعامل الاحترافي مع الأنظمة والبرامج المحاسبية الأكثر استخداماً كبرنامج يمن سوفت والأنظمة السحابية.',
                'icon': 'fa-calculator',
                'image_url': 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400',
                'careers': 'الشركات التجارية والصناعية، مكاتب المحاسبة القانونية والمراجعة، المصارف والبنوك، الأقسام المالية بالمنظمات والوزارات.',
                'courses': [
                    {'code': 'AC-101', 'name': 'مبادئ المحاسبة المالية والمراجعة', 'type': 'نظري + تطبيقات'},
                    {'code': 'AC-202', 'name': 'تطبيقات برامج المحاسبة الآلية (يمن سوفت، إلخ)', 'type': 'عملي معمل حاسوب'},
                    {'code': 'AC-204', 'name': 'محاسبة الضرائب والتكاليف والمراجعة', 'type': 'دراسات محاسبية واقعية'}
                ]
            },
            {
                'name': 'تقنية معلومات (IT)',
                'code': 'it',
                'category': 'tech',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'تصميم وتطوير المواقع والتطبيقات، صيانة وإدارة وتمديد الشبكات، إدارة قواعد البيانات وحماية البيانات، وبناء كفاءات برمجية وتقنية متقدمة.',
                'icon': 'fa-code',
                'image_url': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=400',
                'careers': 'شركات الاتصالات والإنترنت، تطوير مواقع وتطبيقات الويب (Full Stack)، أقسام الدعم الفني وتكنولوجيا المعلومات، إدارة قواعد البيانات والأنظمة السحابية.',
                'courses': [
                    {'code': 'IT-101', 'name': 'أساسيات هندسة الشبكات وتمديدها', 'type': 'عملي معملي بالشبكات'},
                    {'code': 'IT-203', 'name': 'برمجة وتطوير مواقع الويب وتطبيقات الهاتف', 'type': 'عملي كود برمجي'},
                    {'code': 'IT-205', 'name': 'أمن المعلومات وقواعد البيانات SQL', 'type': 'تطبيقي معملي'}
                ]
            },
            {
                'name': 'هندسة ديكور',
                'code': 'decor',
                'category': 'tech',
                'duration': '3 سنوات (دبلوم عالي)',
                'description': 'تأهيل مصممي ديكور مبدعين قادرين على تصميم وتنسيق الديكورات الداخلية للمنازل والشركات والمكاتب والمحلات التجارية بنظرة جمالية ووظيفية ممتازة باستخدام AutoCAD و 3D Max.',
                'icon': 'fa-compass-drafting',
                'image_url': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=400',
                'careers': 'مكاتب التصميم المعماري والديكور، شركات المقاولات والتشطيبات، تصميم الأثاث والمطابخ، العمل الحر كمصمم ديكور ثلاثي الأبعاد.',
                'courses': [
                    {'code': 'ID-102', 'name': 'مبادئ الرسم الهندسي وتوزيع الفراغات', 'type': 'عملي لوحات وتصميم'},
                    {'code': 'ID-203', 'name': 'الرسم والتصميم ثلاثي الأبعاد (3D Max & AutoCAD)', 'type': 'معمل حاسوب تطبيقي'},
                    {'code': 'ID-205', 'name': 'تنسيق الإضاءة والألوان والمواد الإنشائية', 'type': 'مشروع تخرج تطبيقي'}
                ]
            }
        ]
        for dept_data in default_depts:
            Department.objects.create(**dept_data)

    # Seed default labs
    if Lab.objects.count() == 0:
        default_labs = [
            {
                'name': 'معمل تصميم الأسنان الرقمي CAD/CAM',
                'category': 'medical',
                'image_url': 'https://images.unsplash.com/photo-1579684389782-64d84b5e905d?auto=format&fit=crop&q=80&w=400',
                'description': 'يحتوي المعمل على أحدث أجهزة المسح الضوئي ثلاثي الأبعاد 3D Scanners، وأجهزة تفريز الأسنان Milling Machines الرقمية لإنتاج التيجان الخزفية والزركونية بشكل فوري وآلي بالكامل.',
                'specs': ['ماسح ثلاثي الأبعاد', 'مخرطة تفريز خماسية', 'برامج Exocad']
            },
            {
                'name': 'معمل الصيدلة وصناعة المستحضرات',
                'category': 'medical',
                'image_url': 'https://images.unsplash.com/photo-1577158200653-64da653062d3?auto=format&fit=crop&q=80&w=400',
                'description': 'مجهز بأدوات كيميائية متطورة، أجهزة التقطير والتجنيس، وأجهزة ضغط وتصنيع الحبوب السنوية والكريمات لتدريب الطلاب على تحضير الأدوية والمراهم الدوائية المعقمة يدوياً وصناعياً.',
                'specs': ['أجهزة التحليل الطيفي', 'حمام مائي رقمي', 'معامل التركيب']
            },
            {
                'name': 'غرفة العمليات والتعقيم المحاكي',
                'category': 'medical',
                'image_url': 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400',
                'description': 'غرفة عمليات كاملة التجهيز بمحاكاة سريرية لغرف العمليات في المشافي الكبرى، تحتوي على طاولة عمليات تفاعلية، جهاز تخدير محاكي، وأقسام تعقيم الأدوات الجراحية بالأوتوكلاف المعتمد.',
                'specs': ['طاولة عمليات هيدروليكية', 'مونيتور مراقبة الحيوية', 'جهاز تعقيم بخاري Autoclave']
            },
            {
                'name': 'مختبرات التحاليل الطبية والدم',
                'category': 'medical',
                'image_url': 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=400',
                'description': 'معمل مجهز بمجموعة كاملة من المجاهر الضوئية ثنائية العينية المتصلة بشاشات عرض ذكية، أجهزة الطرد المركزي السريعة (Centrifuge)، وحاضنات كيمياء الدم والتحاليل الهرمونية الحديثة.',
                'specs': ['مجاهر أولمبوس يابانية', 'أجهزة طرد رقمية', 'حاضنات تحضين البكتيريا']
            },
            {
                'name': 'جناح الرعاية التمريضية والسريرية',
                'category': 'medical',
                'image_url': 'https://images.unsplash.com/photo-1584515901387-a7a1a7f35360?auto=format&fit=crop&q=80&w=400',
                'description': 'يضم المعمل دمى محاكاة طبية كاملة للتدريب على الإنعاش القلبي الرئوي (CPR) وتركيب المغذيات وسحب الدم والإسعافات الأولية لحالات الجروح والكسور والطورائ الطبية.',
                'specs': ['دمى تدريب CPR ذكية', 'أدوات الحقن الوريدي', 'قياس الضغط والأكسجين']
            },
            {
                'name': 'معمل الشبكات وهندسة البرمجيات',
                'category': 'tech',
                'image_url': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=400',
                'description': 'مجهز بكبائن سيرفرات حقيقية، راوترات ومفاتيح تشغيل سيسكو Cisco Routers، وأجهزة حاسوب بمعالجات عالية المواصفات لتدريب الطلاب على البرمجة، إدارة الخوادم، وصيانة وتصميم الشبكات الرقمية.',
                'specs': ['خوادم راك وسيرفرات', 'راوترات Cisco معتمدة', 'معالجات Core i7 حديثة']
            }
        ]
        for lab_data in default_labs:
            Lab.objects.create(**lab_data)

    # Seed default tuition fees
    if TuitionFee.objects.count() == 0:
        default_fees = [
            {
                'department_name': 'فني أسنان',
                'official_fee': '$1,200',
                'discounted_fee': '$840',
                'installment': '$420',
                'payment_options': 'تقسيط شهري ميسر (8 دفعات)'
            },
            {
                'department_name': 'صيدلة / مختبرات',
                'official_fee': '$1,000',
                'discounted_fee': '$700',
                'installment': '$350',
                'payment_options': 'تقسيط شهري ميسر (8 دفعات)'
            },
            {
                'department_name': 'تمريض عالي / مساعد طبيب',
                'official_fee': '$900',
                'discounted_fee': '$630',
                'installment': '$315',
                'payment_options': 'تقسيط شهري ميسر (8 دفعات)'
            },
            {
                'department_name': 'قبالة وتوليد / فني عمليات',
                'official_fee': '$850',
                'discounted_fee': '$595',
                'installment': '$300',
                'payment_options': 'تقسيط شهري ميسر (8 دفعات)'
            },
            {
                'department_name': 'تقنية معلومات (IT) / هندسة ديكور',
                'official_fee': '$800',
                'discounted_fee': '$560',
                'installment': '$280',
                'payment_options': 'تقسيط شهري ميسر (8 دفعات)'
            },
            {
                'department_name': 'إدارة أعمال / محاسبة مالية',
                'official_fee': '$700',
                'discounted_fee': '$490',
                'installment': '$245',
                'payment_options': 'تقسيط شهري ميسر (8 دفعات)'
            }
        ]
        for fee_data in default_fees:
            TuitionFee.objects.create(**fee_data)

    print("Database seeding completed.")

class Lab(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=50) # medical or tech
    image_url = models.TextField(blank=True, default='')
    description = models.TextField(blank=True, default='')
    specs = models.JSONField(default=list)

    class Meta:
        db_table = 'labs'

    def __str__(self):
        return f"{self.name} ({self.category})"

class TuitionFee(models.Model):
    department_name = models.CharField(max_length=255)
    official_fee = models.CharField(max_length=100)
    discounted_fee = models.CharField(max_length=100)
    installment = models.CharField(max_length=100)
    payment_options = models.CharField(max_length=255)

    class Meta:
        db_table = 'tuition_fees'

    def __str__(self):
        return self.department_name

class ContactMessage(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=255)
    phone = models.CharField(max_length=50, blank=True, default='')
    subject = models.CharField(max_length=500)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'contact_messages'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.subject}"
