const passwordHash = require('password-hash')

const {MongoClient, ObjectID} = require('mongodb')
const fs = require('fs')

const connectionString = 'mongodb+srv://project_drHouse:iq3B2TqA4lro2dGJ@cluster0.sagxs.mongodb.net/drHouse?retryWrites=true&w=majority'

const emailSender = require('./emailSender')

function connect() {
    return new Promise ((resolve, reject) => {
        MongoClient.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(client => {
        resolve(client)
    }).catch(error => {
        reject(error)
    })
    })
}

function registerUser(email, password) {
    return new Promise((resolve, reject) => {
        connect().then(client => {
            const db = client.db('drHouse')
            db.collection('users').findOne({email: email}).then(user => {
                if (user) {
                    client.close()
                    reject('exist')
                } else {
                    db.collection('users').insertOne({
                        email: email,
                        password: passwordHash.generate(password)
                    }).then(response => {
                        client.close()
                        if (response.result.ok) {
                            resolve()
                        } else {
                            reject('you can\'t insert')
                        }
                    }).catch(error => {
                        client.close()
                        reject(error)
                    })
                }
            }).catch(error => {
                client.close()
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function checkUser(email, password) {
    return new Promise((resolve, reject) => {
        connect().then(client => {
            const db = client.db('drHouse')
            db.collection('users').findOne({
                email: email
            }).then(user => {
                client.close()
                if (user) {
                    client.close() 
                    if (passwordHash.verify( password, user.password)) {
                        resolve(user)
                    } else {
                        reject(3)
                    }
                } else {
                    reject(3)
                }

            }).catch(error => {
                client.close()
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function addPatient(patientTitle, patientDescription, patientPdf, patientImgs, userid) {
    return new Promise((resolve, reject) => {
        connect().then(client => {
            const db = client.db('drHouse')
            db.collection('patients').findOne({
                title: patientTitle,
                userid: userid
            }).then(findPatient => {
                if (findPatient) {
                    client.close()
                    reject(3)
                } else {
                    const imgsArr = []
                    patientImgs.forEach((img, idx) => {
                        let ext = img.name.substr(img.name.lastIndexOf('.'))
                        let newName = patientTitle.trim().replace(/ /g,'_') + '_' + userid + '_' + idx + ext
                        img.mv('./public/uploadedfiles/' + newName)
                        imgsArr.push('/uploadedfiles/' + newName)
                    })
                    let pdfName = patientTitle.trim().replace(/ /g, '_') + '_' + userid + '.pdf'
                    patientPdf.mv('./public/uploadedfiles/' + pdfName)
                    let pdfNewUrl = '/uploadedfiles/' + pdfName

                    db.collection('patients').insertOne({
                        title: patientTitle,
                        description : patientDescription,
                        pdfUrl : pdfNewUrl,
                        imgs: imgsArr,
                        userid: userid

                    }).then(response => {
                        client.close()
                        if (response.result.ok) {
                            resolve()
                        } else {
                            reject(new Error('you can\'t insert a patient'))
                        }
                    }).catch(error => {
                        reject(error)
                    })
                }
            }).catch(error => {
                client.close()
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function getAllPatients() {
    return new Promise((resolve, reject) => {
        connect().then(client => {
            const db = client.db('drHouse')
            db.collection('patients').find().toArray().then(patients => {
                patients.forEach(patient => {
                    patient['id'] = patient['_id']
                })
                client.close()
                resolve(patients)
            }).catch(error => {
                client.close()
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function getPatient(id) {
    return new Promise((resolve, reject) => {
        connect().then(client => {
            const db = client.db('drHouse')
            db.collection('patients').findOne({_id: new ObjectID(id)}).then(patient => {
                client.close()
                if(patient) {
                    patient.id = patient._id
                    resolve(patient)
                } else {
                    reject(new Error('Can\'t find a patient with this id : ' + id))
                }
            }).catch(error => {
                client.close()
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function doctorPatients(userid) {
    return new Promise((resolve, reject) => {
        connect().then(client => {
            const db = client.db('drHouse')
            db.collection('patients').find({
                userid: userid
            }).toArray().then(patients => {
                patients.forEach(patient => {
                    patient['id'] = patient['_id']
                })
                client.close()
                resolve(patients)
            }).catch(error => {
                client.close()
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function updatePatient(patientid, newPatientTitle, oldImgsUrls, patientDescription, newPdfPatient, newImgs, userid) {

    return new Promise((resolve, reject) => {
        try {
            (async () => {
                let oldPatientData = await getPatient(patientid)
                const deletedImgs = []
                const keepImgs = []

                let updateNum = 1
                if (oldPatientData.update) {
                    updateNum = oldPatientData.update + 1
                }
                    oldPatientData.imgs.forEach(img => {
                        if (oldImgsUrls.indexOf(img) >= 0 ) {
                            keepImgs.push(img)
                        } else {
                            deletedImgs.push(img)
                        }
                    })
                    const newImgsUrlsArr = []
                    newImgs.forEach((img, idx) => {
                        const imgExt = img.name.substr(img.name.lastIndexOf('.'))
                        const newImgName = newPatientTitle.trim().replace(/ /g, '_') + '_' + userid + '_' + idx + '_' + updateNum + imgExt
                        newImgsUrlsArr.push('/uploadedfiles/' + newImgName)
                        img.mv('./public/uploadedfiles/' + newImgName)
                    })
                    deletedImgs.forEach(file => {
                        if (fs.existsSync('./public' + file)) {
                            fs.unlinkSync('./public' + file)
                        }
                    })
                    if (newPdfPatient) {
                        newPdfPatient.mv('./public' + oldPatientData.pdfUrl)
                    }
                    const client = await connect()
                    const db = client.db('drHouse')
                    const result = await db.collection('patients').updateOne({_id : new ObjectID(patientid)}, {
                        $set: {
                            title: newPatientTitle,
                            description: patientDescription,
                            imgs: [...keepImgs, ...newImgsUrlsArr],
                            update: updateNum
                        }
                    })
                    client.close()
                    resolve()
                
            })()            
        } catch (error){
            reject(error)
        }
    })
}

function deletePatient(patientid, userid) {
    return new Promise((resolve, reject) => {
        getPatient(patientid).then(patient => {
            if (patient.userid === userid) {
                patient.imgs.forEach(img => {
                    if (fs.existsSync('./public' + img)) {
                        fs.unlinkSync('./public' + img)
                    }
                })
                if (fs.existsSync('./public' + patient.pdfUrl)) {
                    fs.unlinkSync('./public' + patient.pdfUrl)
                }
                connect().then(client => {
                    const db = client.db('drHouse')
                    db.collection('patients').deleteOne({_id: new ObjectID(patientid)}).then(() => {
                        client.close()
                        resolve()
                    }).catch(error => {
                        client.close()
                        reject(error)
                    })
                }).catch(error => {
                    reject(error)
                })
            } else {
                reject(new Error('hacking try, not this time'))
            }
        }).catch(error => {
            reject(error)
        })
    })
}

// module.exports = {
//     registerUser,
//     checkUser,
//     addPatient,
//     getAllPatients,
//     getPatient,
//     doctorPatients,
//     updatePatient,
//     deletePatient
// }

